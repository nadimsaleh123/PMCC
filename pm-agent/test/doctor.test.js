import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'pm-doctor-test-'));

const { diagnose, formatDiagnosis } = await import('../src/doctor.js');

const byName = (checks, name) => checks.find((c) => c.name === name);

/** Run diagnose with a controlled environment and restore it afterwards. */
async function run(env = {}) {
  const previous = { ...process.env };

  // Keep it fast and deterministic: never invoke the real CLI.
  process.env.PM_CLAUDE_BIN = path.join(root, 'no-such-claude');
  process.env.LEDGER_ROOT = path.join(root, 'projects');
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_ALLOWED_CHAT_IDS;
  delete process.env.PM_CLAUDE_BUDGET_USD;
  delete process.env.PM_TRANSCRIBE_CMD;
  Object.assign(process.env, env);

  try {
    return await diagnose();
  } finally {
    process.env = previous;
  }
}

test.after(() => rm(root, { recursive: true, force: true }));

test('a missing HOME is a hard failure, because launchd routinely omits it', async () => {
  const checks = await run({ HOME: '' });
  const home = byName(checks, 'HOME');

  assert.equal(home.status, 'fail');
  assert.match(home.fix, /launchd/);
  assert.match(home.fix, /Claude login/);
});

test('a present HOME passes', async () => {
  const checks = await run({ HOME: '/Users/someone' });
  assert.equal(byName(checks, 'HOME').status, 'ok');
});

test('a missing ledger fails with the command that fixes it', async () => {
  const checks = await run({ LEDGER_ROOT: path.join(root, 'nowhere') });
  const ledger = byName(checks, 'Ledger');

  assert.equal(ledger.status, 'fail');
  assert.match(ledger.fix, /pm init/);
});

test('a ledger outside git warns, because nothing would ever be committed', async () => {
  await mkdir(path.join(root, 'projects'), { recursive: true });
  const checks = await run();
  const ledger = byName(checks, 'Ledger');

  // The temp dir is not a git repo, so this is the expected state here.
  assert.equal(ledger.status, 'warn');
  assert.match(ledger.fix, /git init/);
  assert.match(ledger.fix, /contemporaneous record/);
});

test('an empty Telegram allowlist warns that every message will be ignored', async () => {
  const checks = await run();
  const allowlist = byName(checks, 'Telegram allowlist');

  assert.equal(allowlist.status, 'warn');
  assert.match(allowlist.detail, /ignore every message/);
});

test('a populated allowlist passes and counts the chats', async () => {
  const checks = await run({ TELEGRAM_ALLOWED_CHAT_IDS: '111, 222' });
  const allowlist = byName(checks, 'Telegram allowlist');

  assert.equal(allowlist.status, 'ok');
  assert.match(allowlist.detail, /2 chat/);
});

test('a missing Claude CLI warns rather than fails - only /ask needs it', async () => {
  const checks = await run();
  const claude = byName(checks, 'Claude Code');

  assert.equal(claude.status, 'warn');
  assert.match(claude.fix, /Only \/ask needs it/);
});

test('a budget below the cold-cache floor is flagged', async () => {
  // The trap: it works all morning on a warm cache, then starts failing.
  const checks = await run({ PM_CLAUDE_BUDGET_USD: '0.1' });
  const budget = byName(checks, 'Question budget');

  assert.equal(budget.status, 'warn');
  assert.match(budget.fix, /cold/);
});

test('a sensible budget is not flagged at all', async () => {
  const checks = await run({ PM_CLAUDE_BUDGET_USD: '0.5' });
  assert.equal(byName(checks, 'Question budget'), undefined);
});

test('voice transcription being off is reported as fine, not as a problem', async () => {
  const checks = await run();
  const voice = byName(checks, 'Voice notes');

  assert.equal(voice.status, 'ok');
  assert.match(voice.detail, /this is fine/);
});

test('a configured transcriber is reported as configured', async () => {
  const checks = await run({ PM_TRANSCRIBE_CMD: 'whisper-cli -f {input}' });
  assert.match(byName(checks, 'Voice notes').detail, /configured/);
});

test('the report fonts are present, so reports do not fall back', async () => {
  const checks = await run();
  assert.equal(byName(checks, 'Report fonts').status, 'ok');
});

test('the summary counts problems and reads plainly', async () => {
  const failing = formatDiagnosis([
    { status: 'fail', name: 'HOME', detail: 'not set', fix: 'set it' },
    { status: 'ok', name: 'Node', detail: 'v22' },
  ]);
  assert.match(failing, /FAIL {2}HOME/);
  assert.match(failing, /↳ set it/);
  assert.match(failing, /1 problem\(s\) will stop this working/);

  const clean = formatDiagnosis([{ status: 'ok', name: 'Node', detail: 'v22' }]);
  assert.match(clean, /All good/);

  const warned = formatDiagnosis([{ status: 'warn', name: 'X', detail: 'y' }]);
  assert.match(warned, /Nothing broken/);
});
