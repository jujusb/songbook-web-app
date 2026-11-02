#!/usr/bin/env node
/**
 * Migrate the flat `content/` tree into the new separated layout:
 *
 *   /app/data/
 *     content/        ← songs, artists, albums, notes (artists, library, ...)
 *     users/          ← users
 *     setlists/       ← setlists
 *     config/         ← site.yaml, languages.yaml, voices.json
 *     revisions/      ← revision snapshots
 *     music/          ← audio files
 *     content/partitions/ ← sheet-music PDFs
 *
 * Usage:
 *   node scripts/migrate-data-layout.mjs [--dry] [content-dir] [revisions-dir] [music-dir] [partitions-dir] [new-data-dir]
 */
import { readdir, mkdir, rename, rm, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const positional = args.filter((a) => !a.startsWith("--"));
const oldRoot  = path.resolve(positional[0] || process.env.SONGBOOK_CONTENT_DIR || "./content");
const oldRev   = path.resolve(positional[1] || process.env.REVISIONS_DIR || process.env.SONGBOOK_REVISIONS_DIR || path.join(path.dirname(oldRoot), "revisions"));
const oldMusic = path.resolve(positional[2] || process.env.MUSIC_DIR || path.join(path.dirname(oldRoot), "music"));
const oldPart  = path.resolve(positional[3] || path.join(path.dirname(oldRoot), "partitions"));
const newData  = path.resolve(positional[4] || process.env.SONGBOOK_DATA_DIR || "./data");

console.log(`Migrate -> ${newData}` + (dryRun ? " (DRY RUN)" : ""));

async function moveAcross(from, to) {
  try { await rename(from, to); }
  catch (err) {
    if (err.code !== "EXDEV") throw err;
    await copyTree(from, to);
    await rm(from, { recursive: true, force: true });
  }
}
async function copyTree(from, to) {
  const entries = await readdir(from, { withFileTypes: true });
  await mkdir(to, { recursive: true });
  for (const e of entries) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) {
      if (!existsSync(d)) await mkdir(d, { recursive: true });
      await copyTree(s, d);
    } else {
      if (!existsSync(d)) await copyFile(s, d);
    }
  }
}
async function mergeDir(from, to) {
  if (!existsSync(from)) return 0;
  let count = 0;
  await mkdir(to, { recursive: true });
  for (const e of await readdir(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) count += await mergeDir(s, d);
    else {
      if (!existsSync(d)) { if (!dryRun) await moveAcross(s, d); count++; }
      else { console.log(`  skip (exists): ${d}`); }
    }
  }
  try { const ls = await readdir(from); if (ls.length === 0 && !dryRun) await rm(from, { recursive: true, force: true }); } catch {}
  return count;
}

async function main() {
  if (!existsSync(oldRoot)) { console.error(`No content dir at ${oldRoot}`); process.exit(1); }
  const newContent = path.join(newData, "content");
  const newUsers   = path.join(newData, "users");
  const newSetlists= path.join(newData, "setlists");
  const newConfig  = path.join(newData, "config");
  const newRevs    = path.join(newData, "revisions");
  const newMusic   = path.join(newData, "music");
  const newParts   = path.join(newData, "content", "partitions");

  console.log("1) content buckets -> separated");
  await mkdir(newContent, { recursive: true });
  for (const e of await readdir(oldRoot, { withFileTypes: true })) {
    const src = path.join(oldRoot, e.name);
    if (!e.isDirectory()) continue;
    if (e.name === "users")      await mergeDir(src, newUsers);
    else if (e.name === "setlists") await mergeDir(src, newSetlists);
    else if (e.name === "config")  await mergeDir(src, newConfig);
    else if (e.name === "library") await mergeDir(src, path.join(newContent, "library"));
    else await mergeDir(src, path.join(newContent, e.name));
  }

  console.log("2) revisions -> data/revisions");
  if (existsSync(oldRev)) await mergeDir(oldRev, newRevs);

  console.log("3) music -> data/music");
  if (existsSync(oldMusic)) await mergeDir(oldMusic, newMusic);

  console.log("4) partitions -> data/content/partitions");
  if (existsSync(oldPart)) await mergeDir(oldPart, newParts);

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
