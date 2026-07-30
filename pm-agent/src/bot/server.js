/**
 * The Telegram PM agent process.
 *
 * Runs continuously on the Mac mini under launchd. Three modes:
 *   push    - cron fires `pm chase --send` and it starts the conversation
 *   pull    - you ask it something and it answers from the Ledger
 *   capture - you send a voice note or photo and it files the content
 */

import path from 'node:path';
import { Telegram, chunk } from './telegram.js';
import { startChase, answerChase, finishChase, loadSession } from './chase.js';
import { projectPaths, ledgerRoot } from '../ledger/paths.js';
import { readYaml, writeYaml, listFiles, exists, ensureDir } from '../ledger/store.js';
import { loadLatestProgramme, loadLastTwoProgrammes } from '../programme/ingest.js';
import { diffProgrammes } from '../analysis/diff.js';
import { checkProgrammeHealth } from '../analysis/health.js';
import { computeExceptions } from '../analysis/exceptions.js';
import { renderDiff, renderHealth, renderExceptions } from '../report/render.js';
import { commitLedger } from '../ledger/git.js';
import { writeFile } from 'node:fs/promises';
import { today, formatHuman } from '../util/dates.js';

const STATE_FILE = () => path.join(ledgerRoot(), '.agent-state.yaml');

async function readState() {
  return (await readYaml(STATE_FILE())) ?? { activeProject: null, chats: {} };
}

async function writeState(state) {
  await ensureDir(ledgerRoot());
  await writeYaml(STATE_FILE(), state, { header: 'Telegram agent runtime state' });
}

async function listProjects() {
  const root = ledgerRoot();
  if (!(await exists(root))) return [];
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

/**
 * Only respond to chats you have explicitly allowed. A PM bot holds contract
 * sums, rates and claims strategy; an open bot is a disclosure incident.
 */
function isAuthorised(chatId) {
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(String(chatId));
}

const HELP = `*Construction PM agent*

\`/chase\` — start the daily update (I ask, you answer)
\`/status\` — where the project stands right now
\`/diff\` — what changed between the last two P6 updates
\`/health\` — DCMA 14-point check on the current programme
\`/lookahead [days]\` — exceptions coming up in the window
\`/projects\` — list projects · \`/project CODE\` — switch
\`/help\` — this

During a chase: answer naturally, or \`skip\` / \`stop\`.
Anything else I treat as an answer to the question on the table.`;

async function resolveProject(state, chatId) {
  const perChat = state.chats?.[chatId]?.activeProject;
  if (perChat) return perChat;
  if (state.activeProject) return state.activeProject;
  const projects = await listProjects();
  return projects[0] ?? null;
}

async function handleCommand(tg, chatId, text, state) {
  const [rawCommand, ...args] = text.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().replace(/@.*$/, '');
  const project = await resolveProject(state, chatId);

  switch (command) {
    case '/start':
    case '/help':
      await tg.send(chatId, HELP);
      return true;

    case '/projects': {
      const projects = await listProjects();
      await tg.send(
        chatId,
        projects.length
          ? `Projects:\n${projects.map((p) => `- \`${p}\`${p === project ? '  ← active' : ''}`).join('\n')}`
          : `No projects yet. Run \`pm init <CODE>\` on the Mac mini.`,
      );
      return true;
    }

    case '/project': {
      const code = args[0];
      const projects = await listProjects();
      if (!code || !projects.includes(code)) {
        await tg.send(chatId, `Unknown project. Available: ${projects.join(', ') || 'none'}`);
        return true;
      }
      state.chats ??= {};
      state.chats[chatId] = { ...(state.chats[chatId] ?? {}), activeProject: code };
      await writeState(state);
      await tg.send(chatId, `Active project is now *${code}*.`);
      return true;
    }

    case '/chase': {
      if (!project) {
        await tg.send(chatId, 'No project set. `/projects` to see what is available.');
        return true;
      }
      const result = await startChase(project);
      await tg.send(chatId, result.message);
      if (result.question) {
        await tg.send(chatId, `*1/${result.session.queue.length}* — ${result.question}`);
      }
      return true;
    }

    case '/status': {
      if (!project) return true;
      const latest = await loadLatestProgramme(project);
      if (!latest) {
        await tg.send(chatId, `No programme ingested for *${project}* yet.`);
        return true;
      }
      const { programme } = latest;
      const s = programme.stats;
      await tg.send(
        chatId,
        [
          `*${project}* — status`,
          '',
          `Data date: ${formatHuman(programme.project.dataDate)}`,
          `Forecast completion: *${formatHuman(s.forecastFinish)}*`,
          '',
          `${s.complete}/${s.activityCount} activities complete, ${s.inProgress} in progress`,
          `${s.criticalCount} activities on the critical path`,
        ].join('\n'),
      );
      return true;
    }

    case '/diff': {
      if (!project) return true;
      const pair = await loadLastTwoProgrammes(project);
      if (!pair) {
        await tg.send(chatId, `Need two ingested programmes to diff. Only one (or none) so far.`);
        return true;
      }
      const diff = diffProgrammes(pair.previous.programme, pair.current.programme);
      const report = renderDiff(diff);

      const paths = projectPaths(project);
      const file = path.join(paths.reports, `${today()}-programme-diff.md`);
      await ensureDir(paths.reports);
      await writeFile(file, report, 'utf8');
      await commitLedger([file], `report(${project}): programme diff ${diff.from.dataDate} → ${diff.to.dataDate}`);

      const headline = [
        `*${project}* — programme change ${diff.from.dataDate} → ${diff.to.dataDate}`,
        '',
        diff.completionShiftDays
          ? `Completion moved *${Math.abs(diff.completionShiftDays)}d ${diff.completionShiftDays > 0 ? 'later' : 'earlier'}*.`
          : 'Completion unchanged.',
        '',
        ...(diff.redFlags.length ? diff.redFlags.map((f) => `⚠️ ${f}`) : ['No red flags.']),
      ].join('\n');

      await tg.send(chatId, headline);
      await tg.sendDocument(chatId, path.basename(file), report, 'Full change report');
      return true;
    }

    case '/health': {
      if (!project) return true;
      const latest = await loadLatestProgramme(project);
      if (!latest) return true;
      const health = checkProgrammeHealth(latest.programme);
      const report = renderHealth(health);
      await tg.send(
        chatId,
        `*${project}* — ${health.verdict}\n\n${health.failedNames.map((n) => `❌ ${n}`).join('\n') || 'All checks pass.'}`,
      );
      await tg.sendDocument(chatId, `${today()}-schedule-health.md`, report, 'DCMA 14-point detail');
      return true;
    }

    case '/lookahead': {
      if (!project) return true;
      const latest = await loadLatestProgramme(project);
      if (!latest) return true;
      const paths = projectPaths(project);
      const config = (await readYaml(paths.config)) ?? {};
      const days = Number(args[0]) || config.chase?.lookaheadDays || 14;
      const result = computeExceptions(latest.programme, {
        asOf: today(),
        config: { ...(config.chase ?? {}), lookaheadDays: days },
        progress: await readYaml(paths.progress),
        limit: 20,
      });
      for (const part of chunk(renderExceptions(result, { projectCode: project }))) {
        await tg.send(chatId, part);
      }
      return true;
    }

    default:
      return false;
  }
}

async function handleMessage(tg, message, state) {
  const chatId = message.chat.id;

  if (!isAuthorised(chatId)) {
    // Say nothing useful to an unknown chat, but make the chat id visible in
    // the log so you can allowlist yourself on first run.
    console.warn(`[bot] ignoring message from unauthorised chat ${chatId}`);
    return;
  }

  const text = message.text ?? message.caption ?? '';

  if (message.voice || message.audio) {
    await tg.send(
      chatId,
      'Voice note received. Transcription is not wired up yet — send it as text for now, or run `pm diary` on the Mac mini.',
    );
    return;
  }

  if (message.photo) {
    await handlePhoto(tg, chatId, message, state);
    return;
  }

  if (text.startsWith('/')) {
    const handled = await handleCommand(tg, chatId, text, state);
    if (!handled) await tg.send(chatId, `Unknown command. ${HELP}`);
    return;
  }

  // Not a command - treat as an answer to the chase question on the table.
  const project = await resolveProject(state, chatId);
  if (!project) {
    await tg.send(chatId, 'No project set. `/projects` to see what is available.');
    return;
  }

  const session = await loadSession(project);
  if (!session || session.cleared) {
    await tg.send(chatId, 'No chase in progress. `/chase` to start one, or `/help` for what I can do.');
    return;
  }

  const result = await answerChase(project, text);
  await tg.send(chatId, result.message);

  if (result.done) {
    const summary = await finishChase(project);
    await tg.send(chatId, summary.message);
    if (summary.p6) {
      const { readFile } = await import('node:fs/promises');
      await tg.sendDocument(
        chatId,
        path.basename(summary.p6.file),
        await readFile(summary.p6.file),
        'Import into P6 and review before saving.',
      );
    }
  }
}

/** Photos are evidence. File them against the project, dated, with the caption. */
async function handlePhoto(tg, chatId, message, state) {
  const project = await resolveProject(state, chatId);
  if (!project) return;

  const paths = projectPaths(project);
  const day = today();
  const dir = path.join(paths.photos, day);
  await ensureDir(dir);

  // Telegram sends several resolutions; the last is the largest.
  const photo = message.photo.at(-1);
  const buffer = await tg.download(photo.file_id);
  const existing = await listFiles(dir, '.jpg');
  const name = `${day}-${String(existing.length + 1).padStart(3, '0')}.jpg`;
  const file = path.join(dir, name);
  await writeFile(file, buffer);

  const caption = message.caption ?? '';
  const indexFile = path.join(paths.photos, 'index.yaml');
  const index = (await readYaml(indexFile)) ?? { entries: [] };
  index.entries.push({
    file: path.relative(paths.root, file),
    date: day,
    caption: caption || null,
    // Activity linkage comes from the caption when you write one like
    // "A-1240 level 3 blockwork east side".
    activity: /\b([A-Z]{1,4}-?\d{3,5})\b/.exec(caption)?.[1] ?? null,
    receivedAt: new Date().toISOString(),
  });
  await writeYaml(indexFile, index, { header: 'Photo evidence index' });

  await commitLedger([file, indexFile], `evidence(${project}): photo ${name}`);

  await tg.send(
    chatId,
    caption
      ? `Filed as \`${name}\`${/\b([A-Z]{1,4}-?\d{3,5})\b/.test(caption) ? ' and linked to the activity in the caption' : ''}.`
      : `Filed as \`${name}\`. Add a caption with the activity code next time and I will link it.`,
  );
}

export async function runBot({ token = process.env.TELEGRAM_BOT_TOKEN } = {}) {
  const tg = new Telegram(token);
  const me = await tg.call('getMe');
  console.log(`[bot] running as @${me.username}; ledger root ${ledgerRoot()}`);

  if (!process.env.TELEGRAM_ALLOWED_CHAT_IDS) {
    console.warn(
      '[bot] TELEGRAM_ALLOWED_CHAT_IDS is not set — every message will be ignored. ' +
        'Message the bot once and copy the chat id from the log below.',
    );
  }

  for (;;) {
    try {
      const updates = await tg.getUpdates();
      for (const update of updates) {
        if (!update.message) continue;
        const state = await readState();
        try {
          await handleMessage(tg, update.message, state);
        } catch (error) {
          console.error('[bot] handler error:', error);
          if (isAuthorised(update.message.chat.id)) {
            await tg
              .send(update.message.chat.id, `Something broke handling that: ${error.message}`)
              .catch(() => {});
          }
        }
      }
    } catch (error) {
      // Network blips and Telegram 5xx are routine over months of uptime.
      console.error('[bot] poll error, retrying in 5s:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/** Used by the cron entry point to push the morning chase without a /chase. */
export async function pushChase(projectCode, { token = process.env.TELEGRAM_BOT_TOKEN } = {}) {
  const chatIds = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (chatIds.length === 0) throw new Error('TELEGRAM_ALLOWED_CHAT_IDS is not set');

  const tg = new Telegram(token);
  const result = await startChase(projectCode);

  for (const chatId of chatIds) {
    await tg.send(chatId, result.message);
    if (result.question) {
      await tg.send(chatId, `*1/${result.session.queue.length}* — ${result.question}`);
    }
  }

  return result;
}
