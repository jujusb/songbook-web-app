#!/usr/bin/env node
/**
 * Backfill: populate each song's meta.yaml `titles` map from {title: ...}
 * directives in non-default language .cho bodies.
 *
 *  - The DEFAULT language is always taken from meta.title (the curated field)
 *    and is never overwritten — body titles there are often noisy (e.g.
 *    album track numbering), so they are skipped.
 *  - Only languages listed in --languages are considered ('instrumental'
 *    and other auxiliary files are ignored).
 *  - Existing titles entries are kept when no body title is found.
 *
 * New/edited content stays in sync automatically via the app (editor saves
 * sync body {title:} -> meta.titles). Run this once for pre-existing songs.
 *
 * Usage:
 *   node scripts/backfill-song-titles.mjs ./content --default-language es --languages en,es,fr
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
function argValue(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const defaultLanguage = argValue("--default-language") || "en";
const languages = new Set(
  (argValue("--languages") || "en,es,fr").split(",").map((s) => s.trim())
);

const libDir = path.resolve(args[0] || "./content/library");

function extractBodyTitle(body) {
  const match = body.match(/\{title:\s*([^}\n\r]+)\}/i);
  return match ? match[1].trim() : null;
}

function yamlStr(value) {
  if (/^[A-Za-z0-9_][A-Za-z0-9 _\-./()]*$/.test(value)) return `${value}`;
  return `'${value.replaceAll("'", "''")}'`;
}

/** Textually merge a titles map into a YAML meta file, preserving everything else. */
function mergeTitles(raw, titles) {
  const lines = raw.split("\n");
  const titlesKeys = Object.keys(titles);
  if (titlesKeys.length === 0) return raw;

  const block = [
    "titles:",
    ...titlesKeys.map((k) => `  ${k}: ${yamlStr(titles[k])}`),
  ].join("\n");

  // Locate an existing top-level `titles:` block
  let titleIdx = lines.findIndex((l) => /^titles:\s*$/.test(l));
  if (titleIdx === -1) {
    const inline = lines.findIndex((l) => /^titles:\s*/.test(l));
    if (inline !== -1) {
      lines[inline] = block;
      return lines.join("\n");
    }
    return `${raw.replace(/\s+$/, "")}\n${block}\n`;
  }

  let end = titleIdx + 1;
  while (end < lines.length && !/^\S/.test(lines[end])) end++;
  lines.splice(titleIdx, end - titleIdx, block);
  return lines.join("\n");
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === ".revisions") continue;
    dirs.push(path.join(dir, entry.name));
  }
  return dirs;
}

let updated = 0;

for (const albumDir of await walk(libDir)) {
  for (const songDir of await walk(albumDir)) {
    const metaPath = path.join(songDir, "meta.yaml");
    let metaRaw;
    try {
      metaRaw = await readFile(metaPath, "utf-8");
    } catch {
      continue; // not a song folder
    }

    const titles = {};
    for (const entry of await readdir(songDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".cho")) continue;
      const lang = entry.name.slice(0, -4);
      if (!languages.has(lang)) continue; // skip instrumental, etc.
      if (lang === defaultLanguage) continue; // meta.title is authoritative
      const body = await readFile(path.join(songDir, entry.name), "utf-8");
      const title = extractBodyTitle(body);
      if (title) titles[lang] = title;
    }
    if (Object.keys(titles).length === 0) continue;

    const next = mergeTitles(metaRaw, titles);
    if (next !== metaRaw) {
      await writeFile(metaPath, next, "utf-8");
      updated++;
      console.log(`Updated ${path.relative(process.cwd(), metaPath)}`);
    }
  }
}

console.log(
  `Backfill complete (default lang: ${defaultLanguage}, allowed: ${[...languages].join(",")}). ${updated} meta file(s) updated.`
);