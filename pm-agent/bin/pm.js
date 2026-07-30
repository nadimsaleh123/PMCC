#!/usr/bin/env node
/**
 * pm — the Ledger command line.
 *
 * Everything the Telegram agent does is also available here, because when the
 * bot misbehaves you need to run the same operation by hand and see the error.
 */

import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { scaffoldProject } from '../src/ledger/scaffold.js';
import { projectPaths, ledgerRoot } from '../src/ledger/paths.js';
import { ingestXer, loadLatestProgramme, loadLastTwoProgrammes, loadBaselineProgramme } from '../src/programme/ingest.js';
import { computeExceptions } from '../src/analysis/exceptions.js';
import { diffProgrammes } from '../src/analysis/diff.js';
import { checkProgrammeHealth } from '../src/analysis/health.js';
import { renderDiff, renderExceptions, renderHealth } from '../src/report/render.js';
import { readYaml, ensureDir, exists } from '../src/ledger/store.js';
import { commitLedger } from '../src/ledger/git.js';
import { startChase, answerChase, finishChase } from '../src/bot/chase.js';
import { runBot, pushChase } from '../src/bot/server.js';
import { generateWeeklyReport } from '../src/report/generate.js';
import { today } from '../src/util/dates.js';
import { createInterface } from 'node:readline/promises';

const USAGE = `pm — construction Project Ledger

  pm init <CODE> [--name "Project name"]     create a new project ledger
  pm projects                                list projects
  pm ingest <CODE> <file.xer> [--baseline]   parse and archive a P6 export
  pm exceptions <CODE> [--as-of YYYY-MM-DD]  what needs chasing today
  pm chase <CODE> [--send]                   run the chase (terminal, or push to Telegram)
  pm diff <CODE>                             compare the last two programmes
  pm health <CODE>                           DCMA 14-point check
  pm report <CODE> [--pdf] [--as-of DATE]    weekly client report
  pm bot                                     run the Telegram agent

Environment:
  LEDGER_ROOT                  where projects live (default ../projects)
  TELEGRAM_BOT_TOKEN           from @BotFather
  TELEGRAM_ALLOWED_CHAT_IDS    comma-separated chat ids allowed to talk to the bot
`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function requireProgramme(code) {
  const latest = await loadLatestProgramme(code);
  if (!latest) {
    console.error(
      `No parsed programme for ${code}. Run: pm ingest ${code} <file.xer>`,
    );
    process.exit(1);
  }
  return latest;
}

/** Write a report into 06-outputs/reports and commit it. */
async function saveReport(code, filename, content) {
  const paths = projectPaths(code);
  await ensureDir(paths.reports);
  const file = path.join(paths.reports, filename);
  await writeFile(file, content, 'utf8');
  await commitLedger([file], `report(${code}): ${filename}`);
  return file;
}

const commands = {
  async init({ positional, flags }) {
    const code = positional[0];
    if (!code) throw new Error('Usage: pm init <CODE>');
    const paths = await scaffoldProject(code, {
      name: typeof flags.name === 'string' ? flags.name : code,
      force: Boolean(flags.force),
    });
    await commitLedger([paths.root], `ledger(${code}): initialise project`);
    console.log(`Created ${paths.root}`);
    console.log(`\nNext:\n  1. Fill in ${path.relative(process.cwd(), paths.projectBrief)} — especially the contract form and notice periods.`);
    console.log(`  2. pm ingest ${code} <baseline.xer> --baseline`);
    console.log(`  3. pm ingest ${code} <current.xer>`);
  },

  async projects() {
    const root = ledgerRoot();
    if (!(await exists(root))) {
      console.log(`No ledger at ${root}. Run: pm init <CODE>`);
      return;
    }
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(root, { withFileTypes: true });
    const projects = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
    if (projects.length === 0) {
      console.log(`No projects yet in ${root}.`);
      return;
    }
    for (const entry of projects) {
      const latest = await loadLatestProgramme(entry.name);
      console.log(
        `${entry.name.padEnd(16)} ${latest ? `data date ${latest.programme.project.dataDateDay}, ${latest.programme.stats.activityCount} activities` : 'no programme ingested'}`,
      );
    }
  },

  async ingest({ positional, flags }) {
    const [code, file] = positional;
    if (!code || !file) throw new Error('Usage: pm ingest <CODE> <file.xer> [--baseline]');

    const { programme, parsedFile } = await ingestXer(code, path.resolve(file), {
      baseline: Boolean(flags.baseline),
    });

    await commitLedger(
      [projectPaths(code).programme],
      `programme(${code}): ingest ${flags.baseline ? 'baseline' : 'update'} data date ${programme.project.dataDateDay}`,
    );

    console.log(`Parsed ${programme.stats.activityCount} activities, ${programme.stats.relationshipCount} relationships`);
    console.log(`Data date        ${programme.project.dataDateDay}`);
    console.log(`Forecast finish  ${programme.stats.forecastFinish?.slice(0, 10) ?? '-'}`);
    console.log(`Critical         ${programme.stats.criticalCount} activities`);
    console.log(`Written to       ${parsedFile}`);
    console.log(`\nSanity check these against P6 before trusting anything downstream.`);
  },

  async exceptions({ positional, flags }) {
    const code = positional[0];
    if (!code) throw new Error('Usage: pm exceptions <CODE>');
    const { programme } = await requireProgramme(code);
    const paths = projectPaths(code);
    const config = (await readYaml(paths.config)) ?? {};

    const result = computeExceptions(programme, {
      asOf: typeof flags['as-of'] === 'string' ? flags['as-of'] : today(),
      config: config.chase ?? {},
      progress: await readYaml(paths.progress),
      limit: Number(flags.limit) || 20,
    });

    console.log(renderExceptions(result, { projectCode: code }));
  },

  async chase({ positional, flags }) {
    const code = positional[0];
    if (!code) throw new Error('Usage: pm chase <CODE> [--send]');

    if (flags.send) {
      const result = await pushChase(code);
      console.log(`Pushed to Telegram: ${result.status}`);
      return;
    }

    // Terminal chase - the same state machine the bot drives, so the loop can
    // be exercised without Telegram in the way.
    const start = await startChase(code);
    console.log(`\n${start.message}\n`);
    if (start.status !== 'started') return;

    // Iterate lines rather than using rl.question: with piped stdin readline
    // emits every buffered line at once and closes, so question() would drop
    // all but the first answer. Iterating keeps scripted runs working.
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: Boolean(process.stdin.isTTY),
    });
    const lines = rl[Symbol.asyncIterator]();

    const ask = async (prompt) => {
      if (prompt) process.stdout.write(`\n${prompt}\n`);
      process.stdout.write('> ');
      const { value, done } = await lines.next();
      return done ? null : value;
    };

    let prompt = start.question;

    for (;;) {
      const answer = await ask(prompt);
      if (answer === null) {
        console.log('\nInput ended before the chase finished — saving what was answered.');
        const summary = await finishChase(code);
        console.log(`\n${summary.message}`);
        break;
      }

      const result = await answerChase(code, answer);
      console.log(`\n${result.message}`);

      if (result.status === 'stopped' || result.status === 'no-session') break;

      if (result.done) {
        const summary = await finishChase(code);
        console.log(`\n${summary.message}`);
        break;
      }

      // Every subsequent question is already inside result.message, which was
      // just printed. Re-printing it as a prompt would ask it twice.
      prompt = null;
    }

    rl.close();
  },

  async diff({ positional }) {
    const code = positional[0];
    if (!code) throw new Error('Usage: pm diff <CODE>');

    const pair = await loadLastTwoProgrammes(code);
    if (!pair) {
      console.error(`Need at least two ingested programmes for ${code}.`);
      process.exit(1);
    }

    const diff = diffProgrammes(pair.previous.programme, pair.current.programme);
    const report = renderDiff(diff);
    console.log(report);

    const file = await saveReport(code, `${today()}-programme-diff.md`, report);
    console.log(`\nSaved to ${file}`);
  },

  async health({ positional }) {
    const code = positional[0];
    if (!code) throw new Error('Usage: pm health <CODE>');

    const { programme } = await requireProgramme(code);
    const baseline = await loadBaselineProgramme(code);
    const health = checkProgrammeHealth(programme, { baseline: baseline?.programme });
    const report = renderHealth(health);
    console.log(report);

    const file = await saveReport(code, `${today()}-schedule-health.md`, report);
    console.log(`\nSaved to ${file}`);
  },

  async report({ positional, flags }) {
    const code = positional[0];
    if (!code) throw new Error('Usage: pm report <CODE> [--pdf] [--as-of YYYY-MM-DD]');

    const result = await generateWeeklyReport(code, {
      asOf: typeof flags['as-of'] === 'string' ? flags['as-of'] : undefined,
      reportNo: flags.no ? Number(flags.no) : undefined,
      pdf: Boolean(flags.pdf),
      png: typeof flags.png === 'string' ? flags.png : undefined,
    });

    const { model } = result;
    console.log(`Weekly report no. ${model.meta.reportNo}, week ending ${model.meta.weekEnding}`);
    console.log(`  Forecast completion  ${model.kpis.completion.date ?? '-'}${model.kpis.completion.movementDays ? ` (${model.kpis.completion.movementDays > 0 ? '+' : ''}${model.kpis.completion.movementDays}d this week)` : ''}`);
    console.log(`  Status               ${model.status.label} — ${model.status.basis}`);
    console.log(`  Decisions open       ${model.kpis.decisions.open} (${model.kpis.decisions.overdue} overdue)`);
    console.log(`\n  HTML  ${result.htmlFile}`);
    if (result.pdf) console.log(`  PDF   ${result.pdf.file}${result.pdf.pages ? ` (${result.pdf.pages} pages)` : ''}`);
    if (result.sha) console.log(`  Committed ${result.sha.slice(0, 8)}`);

    if (result.warnings.length > 0) {
      console.log('\nBefore this goes to a client:');
      for (const warning of result.warnings) console.log(`  - ${warning}`);
    }

    console.log('\nNothing has been sent. Review it, then issue it yourself.');
  },

  async bot() {
    await runBot();
  },
};

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown command: ${command}\n`);
    console.log(USAGE);
    process.exit(1);
  }

  await handler(parseArgs(rest));
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  process.exit(1);
});
