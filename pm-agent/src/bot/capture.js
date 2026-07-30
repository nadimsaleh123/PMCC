/**
 * Logging register entries from the phone.
 *
 * A risk you thought of on the drive home is worth recording badly at 19:00; it
 * is worth nothing at all if it waits for you to open a laptop. So these accept
 * one line of free text and file it, then say plainly what was left blank rather
 * than inventing an owner, a date or an impact.
 *
 * Nothing here decides anything. Delay responsibility, entitlement and
 * measurement are never touched - this only appends what a human typed.
 */

import { readYaml, writeYaml } from '../ledger/store.js';
import { projectPaths } from '../ledger/paths.js';
import { commitLedger } from '../ledger/git.js';
import { nextRef } from '../ledger/registers.js';
import { today, dayOf } from '../util/dates.js';

/**
 * The registers that can be written from a chat, and how a one-liner maps onto
 * their fields. Deliberately a small set: the ones you think of away from a desk.
 */
export const CAPTURE_KINDS = {
  risk: {
    prefix: 'RISK',
    pathKey: 'risk',
    label: 'Risk',
    header: 'Risk register',
    example: '/risk Snow closes the Bcharreh road in December | owner: PMCC | impact: 2 weeks lost on external works',
  },
  decision: {
    prefix: 'DEC',
    pathKey: 'decisions',
    label: 'Decision required',
    header: 'Decisions required',
    example: '/decision Approve balcony tile sample | owner: Client | due: 2026-08-20',
  },
  action: {
    prefix: 'ACT',
    pathKey: 'actions',
    label: 'Action',
    header: 'Actions',
    example: '/action Issue revised setting-out drawing | owner: Consultant | due: 2026-08-12',
  },
};

/**
 * Parse "subject | key: value | key: value".
 *
 * The pipe is the only syntax, because it is the one thing that survives being
 * typed with one thumb. Unknown keys are kept verbatim rather than dropped - a
 * field this parser has never heard of is still the author's words, and the
 * registers are hand-editable by design.
 */
export function parseCapture(text) {
  const parts = String(text ?? '')
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

  const subject = parts.shift() ?? '';
  const fields = {};
  const unparsed = [];

  for (const part of parts) {
    const match = /^([A-Za-z][A-Za-z ]*?)\s*:\s*(.+)$/.exec(part);
    if (!match) {
      unparsed.push(part);
      continue;
    }
    const key = match[1].trim().toLowerCase().replace(/\s+(.)/g, (_, c) => c.toUpperCase());
    fields[key] = match[2].trim();
  }

  return { subject, fields, unparsed };
}

/** Fields worth prompting for when they are absent, per register. */
const EXPECTED = {
  risk: ['owner', 'impact', 'mitigation'],
  decision: ['owner', 'due'],
  action: ['owner', 'due'],
};

/**
 * Append one entry to a register.
 *
 * @param {string} projectCode
 * @param {'risk'|'decision'|'action'} kind
 * @param {string} text     "subject | owner: X | due: YYYY-MM-DD"
 * @param {object} author   {name, id} - who said it, kept as attribution
 * @returns {Promise<{ref, entry, file, missing: string[], unparsed: string[]}|null>}
 */
export async function captureEntry(projectCode, kind, text, { author } = {}) {
  const spec = CAPTURE_KINDS[kind];
  if (!spec) return null;

  const { subject, fields, unparsed } = parseCapture(text);
  if (!subject) return null;

  const paths = projectPaths(projectCode);
  const file = paths[spec.pathKey];
  const register = (await readYaml(file)) ?? { nextRef: 1, entries: [] };
  register.entries ??= [];
  register.nextRef ??= register.entries.length + 1;

  const ref = nextRef(register, spec.prefix);

  // A date the author wrote is normalised; a date they did not write stays null.
  // "due" is the one field where a wrong guess would put a false deadline into a
  // register that drives chase letters.
  const due = fields.due ?? fields.by ?? fields.dueDate ?? null;

  const entry = {
    ref,
    subject,
    date: today(),
    ...fields,
    ...(due ? { dueDate: dayOf(due) ?? due } : {}),
    status: 'open',
    raisedBy: author?.name ?? null,
    via: 'telegram',
  };
  delete entry.due;
  delete entry.by;

  register.entries.push(entry);
  register.nextRef += 1;

  await writeYaml(file, register, { header: spec.header });
  await commitLedger([file], `ledger(${projectCode}): ${kind} ${ref} — ${subject.slice(0, 60)}`);

  const missing = (EXPECTED[kind] ?? []).filter((f) => !entry[f] && !(f === 'due' && entry.dueDate));

  return { ref, entry, file, missing, unparsed, label: spec.label };
}
