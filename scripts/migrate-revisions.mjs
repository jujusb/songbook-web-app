#!/usr/bin/env node
/**
 * Move revision snapshots out of the song folders.
 *
 * Revisions used to live next to the translation they were a snapshot of:
 *
 *   content/library/<album>/<song>/.revisions/<lang>/<timestamp>.cho
 *
 * They now live in their own tree, next to the content directory:
 *
 *   revisions/<song-id>/<lang>/<timestamp>.cho
 *
 * This script walks the library, moves every snapshot it finds, and removes
 * the emptied `.revisions` folders. A snapshot whose target already exists is
 * kept side by side under a `-1` suffix — nothing is overwritten, nothing is
 * lost.
 *
 * The app migrates lazily as well, so running this script is optional: a song
 * whose snapshots are read is migrated on the spot.
 *
 * Usage:
 *   node scripts/migrate-revisions.mjs [--dry] [content-dir] [revisions-dir]
 *
 * The directories default to $SONGBOOK_CONTENT_DIR and $REVISIONS_DIR
 * (or $SONGBOOK_REVISIONS_DIR), falling back to ./content and ./revisions.
 */
import { readdir, mkdir, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const positional = args.filter((arg) => !arg.startsWith("--"));
const contentDir = path.resolve(
  positional[0] || process.env.SONGBOOK_CONTENT_DIR || "./content"
);
const revisionsDir = path.resolve(
  positional[1] ||
    process.env.REVISIONS_DIR ||
    process.env.SONGBOOK_REVISIONS_DIR ||
    "./revisions"
);
const libraryDir = path.join(contentDir, "library");

/** Move a file, keeping both copies when the destination already exists. */
async function moveFile(from, to) {
  if (!existsSync(to)) {
    if (!dryRun) await rename(from, to);
    return to;
  }
  const { dir, name, ext } = path.parse(to);
  let suffix = 1;
  let target = path.join(dir, `${name}-${suffix}${ext}`);
  while (existsSync(target)) {
    suffix++;
    target = path.join(dir, `${name}-${suffix}${ext}`);
  }
  if (!dryRun) await rename(from, target);
  return target;
}

async function migrateSong(songDir, songId) {
  const legacyDir = path.join(songDir, ".revisions");
  if (!existsSync(legacyDir)) return [];

  const moved = [];
  const langs = await readdir(legacyDir, { withFileTypes: true });
  for (const lang of langs) {
    if (!lang.isDirectory()) continue;
    const from = path.join(legacyDir, lang.name);
    const to = path.join(revisionsDir, songId, lang.name);
    if (!dryRun) await mkdir(to, { recursive: true });
    for (const file of await readdir(from)) {
      if (!file.endsWith(".cho")) continue;
      const source = path.join(from, file);
      const target = await moveFile(source, path.join(to, file));
      moved.push({ source, target });
    }
    if (!dryRun) await rm(from, { recursive: true, force: true });
  }
  if (!dryRun) await rm(legacyDir, { recursive: true, force: true });
  return moved;
}

if (!existsSync(libraryDir)) {
  console.error(`No library at ${libraryDir} — nothing to migrate.`);
  process.exit(1);
}

let total = 0;
const songs = [];

for (const album of await readdir(libraryDir, { withFileTypes: true })) {
  if (!album.isDirectory()) continue;
  const albumDir = path.join(libraryDir, album.name);
  for (const song of await readdir(albumDir, { withFileTypes: true })) {
    if (!song.isDirectory()) continue;
    const moved = await migrateSong(path.join(albumDir, song.name), song.name);
    if (moved.length === 0) continue;
    songs.push(song.name);
    total += moved.length;
    for (const file of moved) {
      console.log(
        `${path.relative(process.cwd(), file.source)} -> ${path.relative(
          process.cwd(),
          file.target
        )}`
      );
    }
  }
}

if (total === 0) {
  console.log("No legacy revisions found — nothing to move.");
} else {
  console.log(
    `\nMoved ${total} snapshot(s) of ${songs.length} song(s) to ${revisionsDir}` +
      (dryRun ? " (dry run — nothing was written)" : "")
  );
}