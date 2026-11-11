#!/usr/bin/env node
/**
 * Migrate setlists to the dated-version storage layout.
 *
 * The current layout keeps static link metadata in the root file and stores
 * the mutable setlist content in a dated version folder:
 *
 *   <data>/setlists/my-setlist.yaml          ← id, title, date, sharing metadata
 *   <data>/setlists/my-setlist/2026-11-01/setlist.yaml
 *
 * Older roots kept the full setlist (songs, description, mode, image, voice
 * shares) in the root YAML. This script copies that content into the root's
 * current-date folder, writes the `date` back to the root, and strips the
 * mutable fields from the root file.
 *
 * When the root has no date, the script reuses a version with identical
 * content if one exists. Otherwise it uses --date, or today's date.
 *
 * If a dated version already exists with different content, it is preserved
 * under a timestamped label before the current content takes the date label.
 *
 * Usage:
 *   node scripts/migrate-setlist-versions.mjs [--dry] [--date YYYY-MM-DD] [setlists-dir]
 *
 * The directory defaults to $SETLIST_DIR, $SETLISTS_DIR, or
 * $DATA_DIR/setlists (falling back to ./data/setlists).
 */
import { readdir, readFile, writeFile, mkdir, rename, rm, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const dateIndex = args.indexOf("--date");
const fallbackDate = dateIndex >= 0 ? args[dateIndex + 1] : undefined;
const positional = args.filter((arg, index) => {
  if (arg.startsWith("--")) return false;
  return dateIndex < 0 || index !== dateIndex + 1;
});
const setlistsDir = path.resolve(
  positional[0] ||
    process.env.SETLIST_DIR ||
    process.env.SETLISTS_DIR ||
    path.join(process.env.DATA_DIR || "./data", "setlists"),
);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VERSION_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;
const MUTABLE_KEYS = ["description", "image", "mode", "songs", "voiceShares"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isDate(value) {
  return typeof value === "string" && DATE_PATTERN.test(value);
}

function labelDate(label) {
  const match = VERSION_DATE_PREFIX.exec(label);
  return match ? match[1] : null;
}

function display(target) {
  const relative = path.relative(process.cwd(), target);
  return relative.startsWith("..") ? target : relative;
}

function contentKey(setlist) {
  return JSON.stringify({
    title: setlist.title,
    description: setlist.description ?? "",
    image: setlist.image ?? "",
    songs: setlist.songs ?? [],
  });
}

function stripMutable(root) {
  const metadata = { ...root };
  for (const key of MUTABLE_KEYS) delete metadata[key];
  return metadata;
}

async function moveAcrossDevices(from, to) {
  try {
    await rename(from, to);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    await copyFile(from, to);
    await rm(from, { force: true });
  }
}

async function uniqueVersionLabel(id, date) {
  const versionsDir = path.join(setlistsDir, id);
  if (!existsSync(path.join(versionsDir, date))) return date;

  const time = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
  let label = `${date}T${time}`;
  let counter = 2;
  while (existsSync(path.join(versionsDir, label))) {
    label = `${date}T${time}-${counter++}`;
  }
  return label;
}

async function readVersionFolders(id) {
  const versionsDir = path.join(setlistsDir, id);
  if (!existsSync(versionsDir)) return [];

  const versions = [];
  for (const entry of await readdir(versionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(versionsDir, entry.name, "setlist.yaml");
    if (!existsSync(filePath)) continue;
    try {
      versions.push({
        label: entry.name,
        dir: path.join(versionsDir, entry.name),
        filePath,
        setlist: yaml.load(await readFile(filePath, "utf-8")),
      });
    } catch (err) {
      console.warn(`! Skipping unreadable version ${display(filePath)}: ${err.message}`);
    }
  }
  return versions;
}

function chooseDate(id, root, versions) {
  if (isDate(root.date)) return { date: root.date, reason: "root date" };

  const key = contentKey(root);
  const match = versions.find((version) => contentKey(version.setlist) === key);
  if (match) {
    const date = isDate(match.setlist.date) ? match.setlist.date : labelDate(match.label);
    if (date) return { date, reason: `content matches version ${match.label}` };
  }

  if (isDate(fallbackDate)) return { date: fallbackDate, reason: "--date" };
  return { date: today(), reason: "today (no date in root or matching version)" };
}

async function migrateSetlist(id) {
  const rootPath = path.join(setlistsDir, `${id}.yaml`);
  const root = yaml.load(await readFile(rootPath, "utf-8"));
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    throw new Error("root YAML is not a setlist object");
  }

  const versions = await readVersionFolders(id);
  const alreadyMigrated = !Object.prototype.hasOwnProperty.call(root, "songs");
  if (alreadyMigrated) {
    if (isDate(root.date) && versions.some((version) => version.label === root.date)) {
      return { id, status: "already migrated", date: root.date };
    }
    if (!isDate(root.date)) {
      throw new Error("root has no songs and no date; cannot determine current version");
    }
    throw new Error(`root has no songs and no version folder for ${root.date}`);
  }

  const { date, reason } = chooseDate(id, root, versions);
  const currentVersion = {
    ...root,
    id: root.id || id,
    title: root.title || id,
    date,
    mode: root.mode || process.env.SETLIST_DEFAULT_MODE || "guitarist",
  };

  let target = versions.find((version) => version.label === date);
  if (target && contentKey(target.setlist) !== contentKey(currentVersion)) {
    const preservedLabel = await uniqueVersionLabel(id, date);
    const preservedDir = path.join(setlistsDir, id, preservedLabel);
    if (!dryRun) await moveAcrossDevices(target.dir, preservedDir);
    console.log(
      `  preserved existing ${display(target.dir)} as ${display(preservedDir)}`,
    );
    target = undefined;
  }

  if (!target) {
    const versionDir = path.join(setlistsDir, id, date);
    if (!dryRun) {
      await mkdir(versionDir, { recursive: true });
      await writeFile(
        path.join(versionDir, "setlist.yaml"),
        yaml.dump(currentVersion, { lineWidth: -1 }),
        "utf-8",
      );
    }
    console.log(`  wrote current content -> ${display(path.join(versionDir, "setlist.yaml"))}`);
  }

  const rootMeta = {
    ...stripMutable(root),
    id: root.id || id,
    title: root.title || id,
    date,
    public: root.public === true,
    subscribers: Array.isArray(root.subscribers) ? root.subscribers : [],
    created: root.created || new Date().toISOString(),
    modified: root.modified || new Date().toISOString(),
  };

  if (!dryRun) {
    await writeFile(rootPath, yaml.dump(rootMeta, { lineWidth: -1 }), "utf-8");
  }
  console.log(`  root metadata -> ${display(rootPath)} (date ${date} from ${reason})`);

  return { id, status: "migrated", date };
}

async function main() {
  if (!existsSync(setlistsDir)) {
    console.error(`No setlists directory at ${setlistsDir}`);
    process.exit(1);
  }
  if (fallbackDate !== undefined && !isDate(fallbackDate)) {
    console.error(`Invalid --date "${fallbackDate}" (expected YYYY-MM-DD)`);
    process.exit(1);
  }

  console.log(`Migrate setlist versions in ${setlistsDir}` + (dryRun ? " (DRY RUN)" : ""));

  let migrated = 0;
  let already = 0;
  let failed = 0;

  for (const entry of await readdir(setlistsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".yaml")) continue;
    const id = entry.name.slice(0, -".yaml".length);
    console.log(`\n${id}`);
    try {
      const result = await migrateSetlist(id);
      if (result.status === "migrated") migrated++;
      else already++;
      console.log(`  ${result.status}`);
    } catch (err) {
      failed++;
      console.error(`  ! ${err.message}`);
    }
  }

  console.log(
    `\n${migrated} migrated, ${already} already up to date, ${failed} failed` +
      (dryRun ? " (dry run — nothing was written)" : ""),
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
