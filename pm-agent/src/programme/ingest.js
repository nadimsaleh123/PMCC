/**
 * Ingest a P6 export into the Ledger.
 *
 * Every XER is archived under its data date and never overwritten. The archive
 * is what makes retrospective delay analysis possible years later - you cannot
 * reconstruct what the programme said last March if you only ever kept the
 * current version.
 */

import path from 'node:path';
import { copyFile } from 'node:fs/promises';
import { parseXerFile } from '../parse/xer.js';
import { normalizeProgramme } from '../parse/normalize.js';
import { projectPaths } from '../ledger/paths.js';
import { ensureDir, writeJson, readJson, listFiles, latestFile, exists } from '../ledger/store.js';
import { today } from '../util/dates.js';

/** Parsed snapshots are named by data date so a plain sort is chronological. */
function snapshotName(programme, fallbackDay) {
  const day = programme.project.dataDateDay ?? fallbackDay;
  return `${day}.json`;
}

/**
 * @param {string} projectCode
 * @param {string} xerFile      path to the .xer to ingest
 * @param {{archive?: boolean, baseline?: boolean}} options
 */
export async function ingestXer(projectCode, xerFile, options = {}) {
  const paths = projectPaths(projectCode);
  const raw = await parseXerFile(xerFile);
  const programme = normalizeProgramme(raw, {
    sourceFile: path.basename(xerFile),
    projectCode,
  });

  const name = snapshotName(programme, today());

  if (options.archive !== false) {
    const targetDir = options.baseline ? paths.baseline : paths.xer;
    await ensureDir(targetDir);
    const archived = path.join(targetDir, `${name.replace(/\.json$/, '')}.xer`);
    if (path.resolve(archived) !== path.resolve(xerFile)) {
      await copyFile(xerFile, archived);
    }
  }

  const parsedDir = options.baseline ? path.join(paths.baseline, 'parsed') : paths.parsed;
  const parsedFile = path.join(parsedDir, name);
  await writeJson(parsedFile, programme);

  return { programme, parsedFile };
}

/** The most recent parsed snapshot, or null if none has been ingested yet. */
export async function loadLatestProgramme(projectCode) {
  const paths = projectPaths(projectCode);
  const file = await latestFile(paths.parsed, '.json');
  if (!file) return null;
  return { programme: await readJson(file), file };
}

/** The two most recent snapshots, for the diff engine. */
export async function loadLastTwoProgrammes(projectCode) {
  const paths = projectPaths(projectCode);
  const files = await listFiles(paths.parsed, '.json');
  if (files.length < 2) return null;
  const [previousFile, currentFile] = files.slice(-2);
  return {
    previous: { programme: await readJson(previousFile), file: previousFile },
    current: { programme: await readJson(currentFile), file: currentFile },
  };
}

export async function loadBaselineProgramme(projectCode) {
  const paths = projectPaths(projectCode);
  const parsedDir = path.join(paths.baseline, 'parsed');
  if (!(await exists(parsedDir))) return null;
  const file = await latestFile(parsedDir, '.json');
  if (!file) return null;
  return { programme: await readJson(file), file };
}
