import { readdir, readFile, mkdir, cp, rename, rm, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { findSongPath } from './paths';

/**
 * Revision snapshots of song translations.
 *
 * Revisions live in their own top-level tree, next to the content directory
 * and outside the library:
 *
 *   content/
 *     library/<album>/<song>/<lang>.cho    # the live translation
 *   revisions/
 *     <song-id>/<lang>/
 *       2026-10-21T18-34-32-794Z.cho       # a snapshot of that translation
 *
 * Snapshots are plain copies of the `.cho` file. They are written before the
 * file is overwritten or deleted, and they are keyed by song id — so moving a
 * song between albums never touches them.
 *
 * Timestamps: on disk the colons and dots of an ISO timestamp are replaced by
 * dashes (`2026-10-21T18-34-32-794Z.cho`). In the API and the UI the same
 * moment is a proper ISO string (`2026-10-21T18:34:32.794Z`). The two
 * formats convert both ways; see `timestampToRevisionFile`.
 *
 * Snapshots pile up: every save of an existing translation writes one. A
 * garbage collector keeps them in check — see `collectRevisions`.
 */

/** Directory name of the revision tree, next to the content directory. */
export const REVISIONS_DIR = 'revisions';

/** Snapshots kept per song and language when nothing else is configured. */
export const DEFAULT_REVISIONS_MAX_COUNT = 50;

/** Age in days after which a snapshot is collected, when nothing else is configured. */
export const DEFAULT_REVISIONS_MAX_AGE_DAYS = 90;

/** Legacy directory name, used before revisions moved out of the library. */
const LEGACY_REVISIONS_DIR = '.revisions';

/** `2026-10-21T18-34-32-794Z`, optionally with a `-1` collision suffix. */
const REVISION_FILE_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z(?:-\d+)?$/;

/** `2026-10-21T18:34:32.794Z` */
const ISO_TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;

/** Ids and language codes become path segments, so they must stay boring. */
const SAFE_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

/** Snapshot file names: letters, digits, dots, dashes, underscores. */
const SAFE_FILE_RE = /^[A-Za-z0-9._-]+\.cho$/;

function isSafeSegment(value: string): boolean {
  return SAFE_SEGMENT_RE.test(value) && value !== '.' && value !== '..';
}

function assertSafeSegment(value: string, label: string): string {
  if (!isSafeSegment(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

/**
 * The root of the revision tree. It sits next to the content directory and
 * outside the library. `REVISIONS_DIR` overrides the location; the default is
 * `<cwd>/revisions` (`/app/revisions` in the Docker image).
 */
export function getRevisionsRoot(): string {
  const configured = process.env.REVISIONS_DIR;
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), REVISIONS_DIR);
}

/** `<revisions-root>/<song-id>/<lang>` */
export function getRevisionsDir(songId: string, lang: string): string {
  return path.join(
    getRevisionsRoot(),
    assertSafeSegment(songId, 'song id'),
    assertSafeSegment(lang, 'language')
  );
}

/** The revisions folder of one song, across all of its languages. */
export function getSongRevisionsDir(songId: string): string {
  return path.join(getRevisionsRoot(), assertSafeSegment(songId, 'song id'));
}

/**
 * The snapshot file name of an ISO timestamp.
 * `2026-10-21T18:34:32.794Z` → `2026-10-21T18-34-32-794Z.cho`
 */
export function timestampToRevisionFile(timestamp: string): string {
  const match = ISO_TIMESTAMP_RE.exec(timestamp);
  if (!match) {
    throw new Error(`Invalid revision timestamp: ${timestamp}`);
  }
  const [, date, hh, mm, ss, ms] = match;
  return `${date}T${hh}-${mm}-${ss}-${ms}Z.cho`;
}

/**
 * The ISO timestamp of a snapshot file name, or null if the name is not a
 * snapshot file name. `2026-10-21T18-34-32-794Z.cho` →
 * `2026-10-21T18:34:32.794Z`
 */
export function revisionFileToTimestamp(file: string): string | null {
  const match = REVISION_FILE_RE.exec(file.replace(/\.cho$/, ''));
  if (!match) return null;
  const [, date, hh, mm, ss, ms] = match;
  return `${date}T${hh}:${mm}:${ss}.${ms}Z`;
}

/**
 * The collision suffix of a snapshot file name: `-1` for the second snapshot
 * of the same millisecond, `0` for the first one.
 */
function revisionFileSuffix(file: string): number {
  const match = /-(\d+)$/.exec(file.replace(/\.cho$/, ''));
  return match ? Number(match[1]) : 0;
}

/**
 * Move the snapshots of a legacy `<songDir>/.revisions/` folder into the
 * revision tree. Called lazily, so an instance that was never migrated by
 * the migration script still finds its snapshots.
 *
 * Failures are swallowed on purpose: the content directory may be mounted
 * read-only, and a song whose folder cannot be touched still has to serve
 * the snapshots that are already in the revision tree.
 */
export async function migrateLegacyRevisions(songId: string, songDir?: string | null): Promise<void> {
  try {
    const dir = songDir ?? (await findSongPath(songId));
    if (!dir) return;
    const legacyDir = path.join(dir, LEGACY_REVISIONS_DIR);
    if (!existsSync(legacyDir)) return;

    const entries = await readdir(legacyDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!isSafeSegment(entry.name)) continue;
      const from = path.join(legacyDir, entry.name);
      const to = getRevisionsDir(songId, entry.name);
      await mkdir(to, { recursive: true });
      for (const file of await readdir(from)) {
        if (!file.endsWith('.cho')) continue;
        await moveFile(path.join(from, file), path.join(to, file));
      }
      await rm(from, { recursive: true, force: true });
    }
    await rm(legacyDir, { recursive: true, force: true });
  } catch {
    // Read-only content dir, or a folder that vanished underneath us.
  }
}

/**
 * Move a file, keeping both copies when the destination already exists.
 * The destination gets a `-1`, `-2`, … suffix so no snapshot is ever lost.
 */
async function moveFile(from: string, to: string): Promise<void> {
  if (!existsSync(to)) {
    await moveAcrossDevices(from, to);
    return;
  }
  const { dir, name, ext } = path.parse(to);
  let suffix = 1;
  let target = path.join(dir, `${name}-${suffix}${ext}`);
  while (existsSync(target)) {
    suffix++;
    target = path.join(dir, `${name}-${suffix}${ext}`);
  }
  await moveAcrossDevices(from, target);
}

/**
 * Move a file to another place.
 *
 * `rename` cannot cross filesystems, and the content directory and the
 * revision tree are usually two different bind mounts — so a plain rename is
 * refused with `EXDEV`. In that case the file is copied and the original is
 * removed, which is slower but does the same thing.
 */
async function moveAcrossDevices(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
    await copyFile(from, to);
    await rm(from, { force: true });
  }
}

/**
 * Save a revision snapshot of a song translation.
 * `sourceFile` is the `.cho` file to copy; `songId` says where the snapshot
 * goes. Returns the snapshot file name without its extension, or an empty
 * string when there was nothing to snapshot.
 */
export async function saveRevision(
  songId: string,
  lang: string,
  sourceFile: string
): Promise<string> {
  if (!existsSync(sourceFile)) return '';

  await migrateLegacyRevisions(songId, path.dirname(sourceFile));

  const revDir = getRevisionsDir(songId, lang);
  await mkdir(revDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let revFile = path.join(revDir, `${timestamp}.cho`);
  let suffix = 1;
  // Two saves within the same millisecond would otherwise collide and silently
  // overwrite each other, losing a revision.
  while (existsSync(revFile)) {
    revFile = path.join(revDir, `${timestamp}-${suffix}.cho`);
    suffix++;
  }
  await cp(sourceFile, revFile);

  // Keep the tree from growing without bound. A failure here must not fail
  // the save: the revision directory may be mounted read-only.
  await collectRevisions(songId, lang).catch(() => undefined);

  return path.basename(revFile, '.cho');
}

/**
 * The snapshots of one translation, newest first.
 */
export async function listRevisions(
  songId: string,
  lang: string
): Promise<{ timestamp: string; file: string }[]> {
  await migrateLegacyRevisions(songId);

  const revDir = getRevisionsDir(songId, lang);
  try {
    const entries = await readdir(revDir);
    return entries
      .filter((f) => f.endsWith('.cho'))
      .map((f) => ({
        timestamp: revisionFileToTimestamp(f) ?? f.replace(/\.cho$/, ''),
        suffix: revisionFileSuffix(f),
        file: f,
      }))
      // Oldest first, so that reversing puts the newest snapshot on top. Two
      // snapshots of the same millisecond are ordered by their suffix.
      .sort((a, b) =>
        a.timestamp === b.timestamp
          ? a.suffix - b.suffix
          : a.timestamp < b.timestamp
            ? -1
            : 1
      )
      .reverse()
      .map(({ timestamp, file }) => ({ timestamp, file }));
  } catch {
    return [];
  }
}

/**
 * The content of one snapshot.
 */
export async function getRevision(
  songId: string,
  lang: string,
  file: string
): Promise<string> {
  await migrateLegacyRevisions(songId);

  const revDir = getRevisionsDir(songId, lang);
  const filePath = await resolveRevisionFile(revDir, file);
  return readFile(filePath, 'utf-8');
}

/**
 * Resolve a snapshot file name to a file inside the revision folder.
 * The name comes from a URL, so it is checked twice: it has to look like a
 * snapshot file name, and it has to stay inside the folder.
 */
async function resolveRevisionFile(revDir: string, file: string): Promise<string> {
  if (!SAFE_FILE_RE.test(file) || path.basename(file) !== file) {
    throw new Error(`Invalid revision file: ${file}`);
  }

  const revRoot = path.resolve(revDir);
  const resolveInside = (candidate: string): string => {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(revRoot + path.sep)) {
      throw new Error(`Invalid revision file: ${file}`);
    }
    return resolved;
  };

  const direct = resolveInside(path.join(revDir, file));
  if (existsSync(direct)) return direct;

  // A snapshot saved in the same millisecond as another one carries a
  // `-1`, `-2`, … suffix. The timestamp alone cannot tell them apart, so
  // fall back to the suffixed files.
  const { dir, name, ext } = path.parse(file);
  for (let suffix = 1; suffix <= 100; suffix++) {
    const target = resolveInside(path.join(dir, `${name}-${suffix}${ext}`));
    if (existsSync(target)) return target;
  }

  return direct;
}

/**
 * Move the snapshots of a song to a new song id. Used when a song is
 * renamed, so the history follows the song.
 */
export async function moveRevisions(oldSongId: string, newSongId: string): Promise<void> {
  if (oldSongId === newSongId) return;

  const from = getSongRevisionsDir(oldSongId);
  if (!existsSync(from)) return;
  const to = getSongRevisionsDir(newSongId);

  await mkdir(to, { recursive: true });
  const entries = await readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!isSafeSegment(entry.name)) continue;
    const langDir = path.join(to, entry.name);
    await mkdir(langDir, { recursive: true });
    for (const file of await readdir(path.join(from, entry.name))) {
      if (!file.endsWith('.cho')) continue;
      await moveFile(path.join(from, entry.name, file), path.join(langDir, file));
    }
  }
  await rm(from, { recursive: true, force: true });
}

// --- Garbage collection ---

/** How many snapshots to keep, and how old they may get. */
export interface RevisionGCConfig {
  /**
   * Keep at most this many snapshots per song and language. The newest ones
   * win. `0` keeps them all.
   */
  maxCount: number;
  /**
   * Collect snapshots that are older than this many days. `0` keeps them all.
   */
  maxAgeDays: number;
}

export interface RevisionGCOptions extends Partial<RevisionGCConfig> {
  /** The moment ages are measured against. Defaults to now. */
  now?: Date;
}

export interface RevisionCollectionResult {
  /** The snapshot files that were deleted. */
  removed: string[];
  /** The snapshot files that are left. */
  kept: number;
}

/**
 * Read the collection limits from the environment.
 *
 * - `REVISIONS_MAX_COUNT` — snapshots kept per song and language (default 50).
 * - `REVISIONS_MAX_AGE_DAYS` — age in days after which a snapshot goes
 *   (default 90).
 *
 * `0` means "keep everything" for either one, so `REVISIONS_MAX_COUNT=0` and
 * `REVISIONS_MAX_AGE_DAYS=0` turn the collector off.
 */
export function getRevisionGCConfig(): RevisionGCConfig {
  return {
    maxCount: readNumber(process.env.REVISIONS_MAX_COUNT, DEFAULT_REVISIONS_MAX_COUNT),
    maxAgeDays: readNumber(process.env.REVISIONS_MAX_AGE_DAYS, DEFAULT_REVISIONS_MAX_AGE_DAYS),
  };
}

function readNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}

/**
 * Collect the snapshots of one translation.
 *
 * A snapshot is deleted when it is older than `maxAgeDays`, or when it falls
 * outside the `maxCount` newest snapshots. Files that are not snapshot names
 * are left alone.
 */
export async function collectRevisions(
  songId: string,
  lang: string,
  options: RevisionGCOptions = {}
): Promise<RevisionCollectionResult> {
  const config = getRevisionGCConfig();
  const maxCount = options.maxCount ?? config.maxCount;
  const maxAgeDays = options.maxAgeDays ?? config.maxAgeDays;
  const now = options.now ?? new Date();
  const revDir = getRevisionsDir(songId, lang);

  let entries: string[];
  try {
    entries = await readdir(revDir);
  } catch {
    return { removed: [], kept: 0 };
  }

  const snapshots = entries
    .filter((file) => file.endsWith('.cho'))
    .map((file) => ({ file, timestamp: revisionFileToTimestamp(file) }))
    .filter((s): s is { file: string; timestamp: string } => s.timestamp !== null)
    .map((s) => ({
      file: s.file,
      date: new Date(s.timestamp).getTime(),
      suffix: revisionFileSuffix(s.file),
    }))
    // Newest first; two snapshots of the same millisecond are ordered by the
    // collision suffix, the higher one being the later write.
    .sort((a, b) => b.date - a.date || b.suffix - a.suffix);

  const cutoff = maxAgeDays > 0 ? now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000 : null;

  const removed: string[] = [];
  snapshots.forEach((snapshot, index) => {
    const tooOld = cutoff !== null && snapshot.date < cutoff;
    const beyondLimit = maxCount > 0 && index >= maxCount;
    if (tooOld || beyondLimit) removed.push(snapshot.file);
  });

  for (const file of removed) {
    try {
      await rm(path.join(revDir, file), { force: true });
    } catch {
      // Read-only mount, or a file that vanished underneath us. The snapshot
      // stays; the next run tries again.
    }
  }

  return { removed, kept: snapshots.length - removed.length };
}

/**
 * Collect the snapshots of every song and language in the revision tree.
 */
export async function collectAllRevisions(
  options: RevisionGCOptions = {}
): Promise<{ removed: number; kept: number; songs: number }> {
  let songIds: string[];
  try {
    songIds = (await readdir(getRevisionsRoot(), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && isSafeSegment(entry.name))
      .map((entry) => entry.name);
  } catch {
    return { removed: 0, kept: 0, songs: 0 };
  }

  let removed = 0;
  let kept = 0;
  for (const songId of songIds) {
    let langs: string[];
    try {
      langs = (await readdir(getSongRevisionsDir(songId), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && isSafeSegment(entry.name))
        .map((entry) => entry.name);
    } catch {
      continue;
    }
    for (const lang of langs) {
      const result = await collectRevisions(songId, lang, options);
      removed += result.removed.length;
      kept += result.kept;
    }
  }

  return { removed, kept, songs: songIds.length };
}
