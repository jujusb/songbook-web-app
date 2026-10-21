#!/usr/bin/env node
/**
 * Collect old revision snapshots.
 *
 * The app keeps the revision tree in check on every save (see
 * `collectRevisions` in `src/lib/content/revisions.ts`). This script does the
 * same over the whole tree, for the songs that are not being edited any more.
 *
 * A snapshot is deleted when
 *
 *   - it is older than `REVISIONS_MAX_AGE_DAYS` days (default 90), or
 *   - it falls outside the `REVISIONS_MAX_COUNT` newest snapshots of its
 *     song and language (default 50).
 *
 * `0` means "keep everything" for either setting, so
 * `REVISIONS_MAX_COUNT=0 REVISIONS_MAX_AGE_DAYS=0` turns the collector off.
 * Files that are not snapshot names are never touched.
 *
 * Usage:
 *   node scripts/collect-revisions.mjs [--dry] [revisions-dir]
 *
 * The directory defaults to $REVISIONS_DIR (or $SONGBOOK_REVISIONS_DIR),
 * falling back to ./revisions.
 */
import { readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const positional = args.filter((arg) => !arg.startsWith("--"));
const revisionsDir = path.resolve(
  positional[0] ||
    process.env.REVISIONS_DIR ||
    process.env.SONGBOOK_REVISIONS_DIR ||
    "./revisions"
);

const DEFAULT_MAX_COUNT = 50;
const DEFAULT_MAX_AGE_DAYS = 90;

/** `2026-10-21T18-34-32-794Z`, optionally with a `-1` collision suffix. */
const REVISION_FILE_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z(?:-\d+)?$/;

function readNumber(raw, fallback) {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}

const maxCount = readNumber(process.env.REVISIONS_MAX_COUNT, DEFAULT_MAX_COUNT);
const maxAgeDays = readNumber(
  process.env.REVISIONS_MAX_AGE_DAYS,
  DEFAULT_MAX_AGE_DAYS
);

/** The ISO timestamp of a snapshot file name, or null if it is not one. */
function revisionFileToTimestamp(file) {
  const match = REVISION_FILE_RE.exec(file.replace(/\.cho$/, ""));
  if (!match) return null;
  const [, date, hh, mm, ss, ms] = match;
  return `${date}T${hh}:${mm}:${ss}.${ms}Z`;
}

/** The collision suffix of a snapshot file name. */
function revisionFileSuffix(file) {
  const match = /-(\d+)$/.exec(file.replace(/\.cho$/, ""));
  return match ? Number(match[1]) : 0;
}

/** The snapshots of one language folder that have to go. */
async function collect(langDir) {
  const entries = await readdir(langDir);
  const snapshots = entries
    .filter((file) => file.endsWith(".cho"))
    .map((file) => ({ file, timestamp: revisionFileToTimestamp(file) }))
    .filter((s) => s.timestamp !== null)
    .map((s) => ({
      file: s.file,
      date: new Date(s.timestamp).getTime(),
      suffix: revisionFileSuffix(s.file),
    }))
    // Newest first.
    .sort((a, b) => b.date - a.date || b.suffix - a.suffix);

  const now = Date.now();
  const cutoff = maxAgeDays > 0 ? now - maxAgeDays * 24 * 60 * 60 * 1000 : null;

  const removed = [];
  snapshots.forEach((snapshot, index) => {
    const tooOld = cutoff !== null && snapshot.date < cutoff;
    const beyondLimit = maxCount > 0 && index >= maxCount;
    if (tooOld || beyondLimit) removed.push(snapshot.file);
  });

  for (const file of removed) {
    if (!dryRun) await rm(path.join(langDir, file), { force: true });
  }

  return removed;
}

if (!existsSync(revisionsDir)) {
  console.error(`No revision tree at ${revisionsDir} — nothing to collect.`);
  process.exit(1);
}

let total = 0;
let songs = 0;

for (const song of await readdir(revisionsDir, { withFileTypes: true })) {
  if (!song.isDirectory()) continue;
  const songDir = path.join(revisionsDir, song.name);
  let langs = [];
  try {
    langs = (await readdir(songDir, { withFileTypes: true })).filter((entry) =>
      entry.isDirectory()
    );
  } catch {
    continue;
  }
  for (const lang of langs) {
    const removed = await collect(path.join(songDir, lang.name));
    if (removed.length === 0) continue;
    songs++;
    total += removed.length;
    for (const file of removed) {
      const full = path.join(songDir, lang.name, file);
      const relative = path.relative(process.cwd(), full);
      console.log(relative.startsWith("..") ? full : relative);
    }
  }
}

if (total === 0) {
  console.log("Nothing to collect.");
} else {
  console.log(
    `\nCollected ${total} snapshot(s) of ${songs} song/language folder(s)` +
      (dryRun ? " (dry run — nothing was written)" : "")
  );
}
