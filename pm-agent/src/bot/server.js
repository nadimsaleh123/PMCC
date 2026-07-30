/**
 * The Telegram PM agent process.
 *
 * Runs continuously on the Mac mini under launchd. Three modes:
 *   push    - cron fires `pm chase --send` and it starts the conversation
 *   pull    - you ask it something and it answers from the Ledger
 *   capture - you send a voice note or photo and it files the content
 */

import path from 'node:path';
import { Telegram, chunk, keyboard } from './telegram.js';
import {
  startChase,
  answerChase,
  finishChase,
  loadSession,
  classifyResponsibility,
  RESPONSIBILITY_BUTTONS,
} from './chase.js';
import { askLedger } from './ask.js';
import { ingestVoiceNote } from './diary.js';
import { entriesOf } from '../ledger/registers.js';
import { openItems, writeChaseDraft } from '../correspondence/chase-draft.js';
import { fileDocument } from '../documents/intake.js';
import { loadBrand } from '../report/html/brand.js';
import { projectPaths, ledgerRoot } from '../ledger/paths.js';
import { readYaml, writeYaml, listFiles, exists, ensureDir } from '../ledger/store.js';
import { loadLatestProgramme, loadLastTwoProgrammes } from '../programme/ingest.js';
import { diffProgrammes } from '../analysis/diff.js';
import { checkProgrammeHealth } from '../analysis/health.js';
import { computeExceptions } from '../analysis/exceptions.js';
import { renderDiff, renderHealth, renderExceptions } from '../report/render.js';
import { generateWeeklyReport } from '../report/generate.js';
import { runAlerts, formatAlertBatch, formatOpenAlerts } from '../alerts/index.js';
import { commitLedger } from '../ledger/git.js';
import { writeFile } from 'node:fs/promises';
import { today, formatHuman, addDays } from '../util/dates.js';

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
 * Only respond to chats you have explicitly allowed. A PM bot holds contract sums,
 * rates and claims strategy; an open bot is a disclosure incident.
 *
 * In a one-to-one chat the chat id and the sender id are the same, so either will
 * do. They diverge in a group, where the chat id identifies the group - so accept
 * both, and let the allowlist hold whichever you added.
 */
function isAuthorised(chatId, fromId) {
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(String(chatId)) || (fromId && allowed.includes(String(fromId)));
}

/**
 * Who sent this.
 *
 * Attribution is not bookkeeping - a diary entry that names the person who reported
 * it is materially stronger evidence than one that says "telegram", and it cannot be
 * reconstructed later.
 */
function authorOf(message) {
  const from = message.from ?? {};
  const name =
    [from.first_name, from.last_name].filter(Boolean).join(' ') ||
    from.username ||
    `telegram:${from.id}`;
  return { id: from.id ?? message.chat.id, name, username: from.username ?? null };
}

const HELP = `*Construction PM agent*

\`/chase\` — start the daily update (I ask, you answer)
\`/status\` — where the project stands right now
\`/alerts\` — what is currently flagged
\`/report\` — this week's client report as a PDF
\`/ask <question>\` — anything about the project record (or just start with \`?\`)
\`/open\` — decisions, actions and RFIs waiting on someone
\`/nudge REF\` — draft a chase letter for that reference
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

async function handleCommand(tg, chatId, text, state, author) {
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
      // One button per project; a tap is exactly `/project CODE`.
      await tg.send(
        chatId,
        projects.length
          ? `Projects:\n${projects.map((p) => `- \`${p}\`${p === project ? '  ← active' : ''}`).join('\n')}\n\n_Tap to switch:_`
          : `No projects yet. Run \`pm init <CODE>\` on the Mac mini.`,
        projects.length
          ? keyboard(projects.map((p) => [{ label: p === project ? `${p} ←` : p, send: `/project ${p}` }]))
          : {},
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
      const result = await startChase(project, { author });
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

    case '/ask': {
      if (!project) return true;
      const question = args.join(' ').trim();
      if (!question) {
        await tg.send(chatId, 'Ask me something — `/ask when did we first raise the block shortage?`');
        return true;
      }
      await handleAsk(tg, chatId, project, question, state);
      return true;
    }

    case '/open': {
      if (!project) return true;
      const items = await openItems(project);

      if (items.length === 0) {
        await tg.send(chatId, `*${project}* — nothing outstanding with anyone.`);
        return true;
      }

      const lines = [`*${project}* — ${items.length} item${items.length === 1 ? '' : 's'} with someone else`, ''];
      for (const item of items) {
        const when =
          item.daysRemaining === null
            ? item.daysOpen !== null
              ? `open ${item.daysOpen}d`
              : 'no date'
            : item.daysRemaining < 0
              ? `*${Math.abs(item.daysRemaining)}d overdue*`
              : `due in ${item.daysRemaining}d`;
        lines.push(`\`${item.ref}\` ${item.subject}`);
        lines.push(`   ${item.owner ?? 'unassigned'} · ${when}`);
      }
      lines.push('');
      lines.push('`/nudge REF` to draft a chase letter.');

      for (const part of chunk(lines.join('\n'))) await tg.send(chatId, part);
      return true;
    }

    case '/nudge': {
      if (!project) return true;
      const ref = args[0];
      if (!ref) {
        await tg.send(chatId, 'Which one? `/nudge DEC-001`. `/open` lists them.');
        return true;
      }

      const brand = await loadBrand(project);
      const draft = await writeChaseDraft(project, ref, { brand });

      if (!draft) {
        await tg.send(chatId, `No entry with reference \`${ref}\` in any register.`);
        return true;
      }

      await commitLedger([draft.file], `correspondence(${project}): chase draft for ${draft.entry.ref}`);
      await tg.sendDocument(
        chatId,
        path.basename(draft.file),
        draft.body,
        `Draft chase for ${draft.entry.ref}. Review it, then send it yourself.`,
      );

      if (draft.missing.length > 0) {
        await tg.send(
          chatId,
          `The record is thin, so the draft leaves things out:\n${draft.missing.map((m) => `- ${m}`).join('\n')}`,
        );
      }
      return true;
    }

    case '/alerts': {
      if (!project) return true;
      // On demand, list everything open - including the quiet ones that were
      // deliberately not re-sent this morning.
      const result = await runAlerts(project);
      for (const part of chunk(formatOpenAlerts(project, result.open, { asOf: result.asOf }))) {
        await tg.send(chatId, part);
      }
      return true;
    }

    case '/report': {
      if (!project) return true;
      await tg.send(chatId, `Building this week's report for *${project}*…`);

      try {
        const result = await generateWeeklyReport(project, { pdf: true });
        const { readFile } = await import('node:fs/promises');
        const file = result.pdf?.file ?? result.htmlFile;

        await tg.sendDocument(
          chatId,
          path.basename(file),
          await readFile(file),
          `Weekly report no. ${result.model.meta.reportNo}. Review it, then issue it yourself.`,
        );

        if (result.warnings.length > 0) {
          await tg.send(
            chatId,
            `Before this goes to a client:\n${result.warnings.map((w) => `- ${w}`).join('\n')}`,
          );
        }
      } catch (error) {
        // Most likely Playwright missing; the HTML was still written.
        await tg.send(chatId, `Could not build the PDF: ${error.message}`);
      }
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

  const author = authorOf(message);

  if (!isAuthorised(chatId, author.id)) {
    // Say nothing useful to an unknown chat, but make the chat id visible in
    // the log so you can allowlist yourself on first run.
    console.warn(`[bot] ignoring message from unauthorised chat ${chatId}`);
    return;
  }

  const text = message.text ?? message.caption ?? '';

  if (message.voice || message.audio) {
    await handleVoice(tg, chatId, message, state, author);
    return;
  }

  if (message.photo) {
    await handlePhoto(tg, chatId, message, state, author);
    return;
  }

  if (message.document) {
    await handleDocument(tg, chatId, message, state, author);
    return;
  }

  if (text.startsWith('/')) {
    const handled = await handleCommand(tg, chatId, text, state, author);
    if (!handled) await tg.send(chatId, `Unknown command. ${HELP}`);
    return;
  }

  const project = await resolveProject(state, chatId);
  if (!project) {
    await tg.send(chatId, 'No project set. `/projects` to see what is available.');
    return;
  }

  // An outstanding "who caused it" question takes precedence over everything.
  const pending = state.chats?.[chatId]?.pendingEvent;
  if (pending) {
    await resolvePendingEvent(tg, chatId, pending, text, state);
    return;
  }

  // A leading "?" marks an explicit question. Everything else stays routed to the
  // chase answer, so an ordinary message can never silently cost money.
  if (text.trimStart().startsWith('?')) {
    await handleAsk(tg, chatId, project, text.trim().slice(1).trim(), state);
    return;
  }

  // Not a command - treat as an answer to the chase question on the table.
  const session = await loadSession(project, author);
  if (!session || session.cleared) {
    await tg.send(chatId, 'No chase in progress. `/chase` to start one, or `/help` for what I can do.');
    return;
  }

  const result = await answerChase(project, text, { author });
  await tg.send(chatId, result.message, result.buttons ? keyboard(result.buttons) : {});

  if (result.done) {
    const summary = await finishChase(project, null, { author });
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

/**
 * Answer a question from the ledger.
 *
 * Each call costs real money, so there is a per-query cap (passed to the CLI) and a
 * daily ceiling tracked here. A runaway loop on an unattended bot should cost a few
 * dollars, not a few hundred.
 */
async function handleAsk(tg, chatId, project, question, state) {
  const dailyCapUsd = Number(process.env.PM_CLAUDE_DAILY_USD) || 5;
  const day = today();

  state.askSpend ??= {};
  const spentToday = state.askSpend[day] ?? 0;

  if (spentToday >= dailyCapUsd) {
    await tg.send(
      chatId,
      `Daily question budget of $${dailyCapUsd.toFixed(2)} is spent ($${spentToday.toFixed(2)} today). ` +
        `Raise PM_CLAUDE_DAILY_USD if that is too tight.`,
    );
    return;
  }

  await tg.send(chatId, '_Reading the project record…_');
  const result = await askLedger(project, question);

  if (!result.ok) {
    await tg.send(chatId, `Could not answer that: ${result.error}`);
    return;
  }

  if (result.costUsd) {
    state.askSpend[day] = spentToday + result.costUsd;
    // Keep only the current day; this is a budget guard, not an audit trail.
    state.askSpend = { [day]: state.askSpend[day] };
    await writeState(state);
  }

  for (const part of chunk(result.result)) await tg.send(chatId, part);
}

/**
 * A voice note becomes a dated site diary entry.
 *
 * Whatever else fails, the audio is filed and the transcript reaches the diary -
 * see diary.js. The one thing this must not do is infer who caused a delay, so a
 * detected delay ends with a question rather than a conclusion.
 */
async function handleVoice(tg, chatId, message, state, author) {
  const project = await resolveProject(state, chatId);
  if (!project) {
    await tg.send(chatId, 'No project set. `/projects` to see what is available.');
    return;
  }

  const media = message.voice ?? message.audio;
  await tg.send(chatId, '_Transcribing…_');

  const buffer = await tg.download(media.file_id);
  const result = await ingestVoiceNote(project, {
    buffer,
    extension: media.mime_type === 'audio/mpeg' ? '.mp3' : '.ogg',
    caption: message.caption ?? null,
    author,
  });

  if (!result.ok) {
    // Voice transcription being switched off is a configuration choice, not a
    // fault, and should not be reported as one.
    await tg.send(
      chatId,
      result.configured
        ? `The audio is filed as evidence, but transcription failed.\n\n${result.error}\n\nSend it as text and it goes straight into the diary.`
        : `Filed the recording as evidence. Voice transcription is switched off, so send me the update as text and it goes straight into the diary.`,
    );
    return;
  }

  const summary = [`Recorded to the site diary for today.`, ''];
  if (result.structured) {
    const s = result.structured;
    const parts = [];
    if (s.weather) parts.push(`weather: ${s.weather}`);
    if (s.manpower?.length) parts.push(`${s.manpower.length} trade(s) on site`);
    if (s.works?.length) parts.push(`${s.works.length} work item(s)`);
    if (s.instructions?.length) parts.push(`${s.instructions.length} instruction(s)`);
    if (parts.length) summary.push(parts.join(' · '));
  } else {
    summary.push('_Structuring was unavailable, so the transcript went in verbatim._');
  }

  await tg.send(chatId, summary.join('\n'));

  if (result.event) {
    state.chats ??= {};
    state.chats[chatId] = {
      ...(state.chats[chatId] ?? {}),
      pendingEvent: { project, ref: result.event.ref },
    };
    await writeState(state);

    await tg.send(
      chatId,
      `I heard something that sounds like a delay, and logged it as *${result.event.ref}*.\n\n` +
        `Was it *client/consultant-caused*, *our own/supplier*, or *neutral* (weather etc.)? ` +
        `It decides whether this supports a claim later, so I will not guess.`,
      keyboard(RESPONSIBILITY_BUTTONS),
    );
  }
}

/** Apply a responsibility answer to an event raised from a voice note. */
async function resolvePendingEvent(tg, chatId, pending, text, state) {
  const paths = projectPaths(pending.project);
  const events = await readYaml(paths.events);
  const entry = entriesOf(events).find((e) => e.ref === pending.ref);

  if (entry) {
    entry.responsibility = classifyResponsibility(text);
    entry.clarification = text;

    // Same rule as the chase loop: the notice clock starts from awareness
    // regardless of fault, and it is the clock most claims are lost on.
    const config = (await readYaml(paths.config)) ?? {};
    const noticeDays = config.contract?.delayNoticeDays ?? null;

    if (noticeDays && entry.responsibility !== 'contractor') {
      entry.noticeDeadline = addDays(entry.date, noticeDays);
      entry.noticeBasis = `${noticeDays} days from awareness (${entry.date}) per project.yaml contract.delayNoticeDays`;
    }

    await writeYaml(paths.events, events);
    await commitLedger([paths.events], `ledger(${pending.project}): classify ${pending.ref} as ${entry.responsibility}`);
  }

  delete state.chats[chatId].pendingEvent;
  await writeState(state);

  await tg.send(
    chatId,
    entry?.noticeDeadline
      ? `Logged as *${entry.responsibility}*.\n\n📄 Notice for ${pending.ref} due by *${formatHuman(entry.noticeDeadline)}*.\n\n_Check the clause before issuing. I draft; you send._`
      : `Logged as *${entry?.responsibility ?? 'unclassified'}*.`,
  );
}

/**
 * A document sent to the bot from anywhere lands in the Ledger on the Mac mini.
 *
 * This is the whole answer to "the machine is in Dubai and I am not": send the
 * contract from your phone and it is filed, hashed and committed.
 */
async function handleDocument(tg, chatId, message, state, author) {
  const project = await resolveProject(state, chatId);
  if (!project) {
    await tg.send(chatId, 'No project set. `/projects` to see what is available.');
    return;
  }

  const doc = message.document;
  const caption = message.caption ?? '';

  // Telegram's bot API will not hand over a file above 20 MB. A drawing set will
  // exceed that, so say what to do rather than failing obscurely.
  if (doc.file_size && doc.file_size > 20 * 1024 * 1024) {
    await tg.send(
      chatId,
      `\`${doc.file_name}\` is ${(doc.file_size / 1024 / 1024).toFixed(0)} MB. Telegram will not let me download anything over 20 MB.\n\n` +
        `Drop it in the inbox folder instead — it syncs to the Mac mini and gets filed the same way.`,
    );
    return;
  }

  await tg.send(chatId, '_Filing…_');

  const result = await fileDocument(project, {
    buffer: await tg.download(doc.file_id),
    filename: doc.file_name ?? 'document',
    hint: caption,
    note: caption || null,
    author,
    via: 'telegram',
  });

  if (result.status === 'duplicate') {
    await tg.send(
      chatId,
      `Already have that exact file — filed ${result.of.date} as \`${result.of.file}\`. Nothing added.`,
    );
    return;
  }

  await tg.send(
    chatId,
    [
      `Filed as *${result.category}*.`,
      '',
      `\`${result.record.file}\``,
      `sha256 \`${result.record.sha256.slice(0, 16)}…\``,
      '',
      caption
        ? ''
        : '_Tip: add a caption like "contract" or "drawing" and I file it in the right folder._',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

/** Photos are evidence. File them against the project, dated, with the caption. */
async function handlePhoto(tg, chatId, message, state, author) {
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
    takenBy: author?.name ?? null,
    takenById: author?.id ?? null,
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

/**
 * Turn a button press into the message it stands for.
 *
 * Every button carries "t:" plus the text a person would have typed, so a tap
 * runs through handleMessage exactly like typing - same authorisation, same
 * attribution, same record. The press is acknowledged and the buttons removed
 * first, so a double-tap cannot answer the same question twice.
 */
export async function asMessage(tg, callbackQuery) {
  if (!callbackQuery) return null;
  await tg.answerCallbackQuery(callbackQuery.id);

  const source = callbackQuery.message;
  const data = callbackQuery.data ?? '';
  if (!source?.chat || !data.startsWith('t:')) return null;

  await tg.clearButtons(source.chat.id, source.message_id);
  return { chat: source.chat, from: callbackQuery.from, text: data.slice(2) };
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
        const message = update.message ?? (await asMessage(tg, update.callback_query));
        if (!message) continue;
        const state = await readState();
        try {
          await handleMessage(tg, message, state);
        } catch (error) {
          console.error('[bot] handler error:', error);
          if (isAuthorised(message.chat.id, message.from?.id)) {
            await tg
              .send(message.chat.id, `Something broke handling that: ${error.message}`)
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

/**
 * Where a scheduled push for this project should go.
 *
 * `project.yaml` may name a chat, so a project with its own group does not spray
 * every other project's alerts at it. That chat must still be in the allowlist -
 * a per-project setting can narrow the audience but never widen it, or editing a
 * yaml file would be enough to exfiltrate a ledger.
 */
export async function resolveChatIds(projectCode) {
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length === 0) throw new Error('TELEGRAM_ALLOWED_CHAT_IDS is not set');

  const config = (await readYaml(projectPaths(projectCode).config)) ?? {};
  const preferred = config.telegram?.chatId;

  if (preferred && allowed.includes(String(preferred))) return [String(preferred)];

  if (preferred) {
    console.warn(
      `[bot] project.yaml for ${projectCode} names chat ${preferred}, which is not in TELEGRAM_ALLOWED_CHAT_IDS - ignoring it.`,
    );
  }

  return allowed;
}

/** Used by the cron entry point to push the morning chase without a /chase. */
export async function pushChase(projectCode, { token = process.env.TELEGRAM_BOT_TOKEN } = {}) {
  const chatIds = await resolveChatIds(projectCode);
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

/**
 * Scheduled alert run. Sends nothing on a quiet day, which is the whole point -
 * the value of an alert is destroyed by the ones that did not need sending.
 */
export async function pushAlerts(projectCode, { token = process.env.TELEGRAM_BOT_TOKEN, asOf } = {}) {
  const result = await runAlerts(projectCode, { asOf });

  if (result.toSend.length === 0) return result;

  const chatIds = await resolveChatIds(projectCode);
  const tg = new Telegram(token);
  const message = formatAlertBatch(projectCode, result.toSend, { asOf: result.asOf });

  for (const chatId of chatIds) {
    for (const part of chunk(message)) await tg.send(chatId, part);
  }

  return result;
}
