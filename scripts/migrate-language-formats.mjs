#!/usr/bin/env node
/**
 * Rename on-disk language codes to the app's new format and update references:
 *   en -> en-US, es -> es-ES, fr -> fr-FR, pt -> pt-BR
 *
 * Updates song `.cho`/`.txt` files, revision/music directories, and the
 * `language:`/`titles`/`defaultLanguage` fields in YAML files.
 *
 * Usage:
 *   node scripts/migrate-language-formats.mjs [--dry] [content-dir] [revisions-dir] [music-dir]
 */
import { readdir, rename, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const yaml = require("js-yaml");

const MAP = { en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-BR" };

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const positional = args.filter((a) => !a.startsWith("--"));
const contentDir = path.resolve(positional[0] || process.env.SONGBOOK_CONTENT_DIR || (existsSync("/app/data/content") ? "/app/data/content" : "./content"));
const revisionsDir = path.resolve(positional[1] || process.env.REVISIONS_DIR || "./revisions");
const musicDir = path.resolve(positional[2] || process.env.MUSIC_DIR || "./music");

console.log("Migrating language codes" + (dryRun ? " (DRY RUN)" : ""));

async function move(from, to) {
  if (dryRun) { console.log(`  rename ${from} -> ${to}`); return; }
  await mkdir(path.dirname(to), { recursive: true });
  await rename(from, to);
}

async function walk(dir, cb) {
  if (!existsSync(dir)) return;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, cb);
    else await cb(p);
  }
}

async function migrateLibrary(dir) {
  if (!existsSync(dir)) return;
  for (const album of await readdir(dir, { withFileTypes: true })) {
    if (!album.isDirectory()) continue;
    const albumDir = path.join(dir, album.name);
    for (const song of await readdir(albumDir, { withFileTypes: true })) {
      if (!song.isDirectory()) continue;
      const songDir = path.join(albumDir, song.name);
      for (const oldCode of Object.keys(MAP)) {
        const newCode = MAP[oldCode];
        for (const ext of [".cho", ".txt"]) {
          const from = path.join(songDir, `${oldCode}${ext}`);
          if (existsSync(from)) await move(from, path.join(songDir, `${newCode}${ext}`));
        }
      }
      await migrateYaml(path.join(songDir, "meta.yaml"));
    }
  }
}

async function migrateRevisions(dir) {
  if (!existsSync(dir)) return;
  for (const song of await readdir(dir, { withFileTypes: true })) {
    if (!song.isDirectory()) continue;
    const songDir = path.join(dir, song.name);
    for (const oldCode of Object.keys(MAP)) {
      const from = path.join(songDir, oldCode);
      if (existsSync(from)) await move(from, path.join(songDir, MAP[oldCode]));
    }
  }
}

async function migrateMusic(dir) {
  if (!existsSync(dir)) return;
  for (const song of await readdir(dir, { withFileTypes: true })) {
    if (!song.isDirectory()) continue;
    const songDir = path.join(dir, song.name);
    let langs = [];
    try { langs = await readdir(songDir, { withFileTypes: true }); } catch { continue; }
    for (const lang of langs) {
      if (!lang.isDirectory() || !MAP[lang.name]) continue;
      await move(path.join(songDir, lang.name), path.join(songDir, MAP[lang.name]));
    }
  }
}

async function migrateYaml(filePath) {
  if (!existsSync(filePath)) return;
  const raw = await readFile(filePath, "utf-8");
  let doc;
  try { doc = yaml.load(raw); } catch { return; }
  if (!doc || typeof doc !== "object") return;
  let changed = false;
  if (typeof doc.defaultLanguage === "string" && MAP[doc.defaultLanguage]) {
    doc.defaultLanguage = MAP[doc.defaultLanguage]; changed = true;
  }
  if (doc.titles && typeof doc.titles === "object") {
    const next = {};
    for (const [k, v] of Object.entries(doc.titles)) {
      const nk = MAP[k] || k; if (nk !== k) changed = true;
      next[nk] = v;
    }
    doc.titles = next;
  }
  if (typeof doc.language === "string" && MAP[doc.language]) {
    doc.language = MAP[doc.language]; changed = true;
  }
  if (!changed) return;
  if (dryRun) { console.log(`  update ${filePath}`); return; }
  await writeFile(filePath, yaml.dump(doc, { lineWidth: -1 }), "utf-8");
}

async function migrateChoFile(filePath) {
  const raw = await readFile(filePath, "utf-8");
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return;
  let fm;
  try { fm = yaml.load(m[1]); } catch { return; }
  if (!fm || typeof fm !== "object" || typeof fm.language !== "string" || !MAP[fm.language]) return;
  fm.language = MAP[fm.language];
  const newFm = "---\n" + yaml.dump(fm, { lineWidth: -1 }).trim() + "\n---";
  const updated = newFm + raw.slice(m[0].length);
  if (dryRun) { console.log(`  update ${filePath}`); return; }
  await writeFile(filePath, updated, "utf-8");
}

async function main() {
  await migrateLibrary(path.join(contentDir, "library"));
  await migrateLibrary(path.join(contentDir, "albums")); // best-effort if album-nested songs exist
  await migrateRevisions(revisionsDir);
  await migrateMusic(musicDir);
  await walk(contentDir, async (p) => {
    if (p.endsWith(".yaml") || p.endsWith(".yml")) await migrateYaml(p);
    if (p.endsWith(".cho")) await migrateChoFile(p);
  });
  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
