import { readdir } from 'fs/promises';
import path from 'path';

/**
 * Filesystem locations of the content and data trees.
 *
 * These live in their own module so that `revisions.ts` can resolve paths
 * without importing `index.ts` — `index.ts` imports the revision helpers, and
 * a cycle between the two would make the module init order significant.
 *
 * The new layout keeps setlists, config and users under `DATA_DIR`, separate
 * from the song/artist/album/notes content that lives under `DATA_DIR/content`.
 */

export function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

export function getContentDir(): string {
  if (process.env.CONTENT_DIR) return process.env.CONTENT_DIR;
  return path.join(getDataDir(), "content");
}

export function getLibraryDir(): string {
  return path.join(getContentDir(), 'library');
}

export function getSetlistsDir(): string {
  if (process.env.SETLIST_DIR) return process.env.SETLIST_DIR;
  if (process.env.SETLISTS_DIR) return process.env.SETLISTS_DIR;
  return path.join(getDataDir(), "setlists");
}

export function getConfigDir(): string {
  if (process.env.CONFIG_DIR) return process.env.CONFIG_DIR;
  return path.join(getDataDir(), "config");
}

export function getUsersDir(): string {
  if (process.env.USERS_DIR) return process.env.USERS_DIR;
  return path.join(getDataDir(), "users");
}

/**
 * Find the folder of a song anywhere in the library.
 * Songs live at `content/library/<album-id>/<song-id>/`, and song ids are
 * unique across albums.
 */
export async function findSongPath(songId: string): Promise<string | null> {
  const libDir = getLibraryDir();
  try {
    const { readdir } = await import("fs/promises");
    const entries = await readdir(libDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // eslint-disable-next-line no-await-in-loop
      const fs = await import("fs");
      const songDir = path.join(libDir, entry.name, songId);
      if (fs.existsSync(songDir)) {
        return songDir;
      }
    }
  } catch {
    // library dir doesn't exist
  }
  return null;
}

/** The album folder a song lives in, or null if the song does not exist. */
export async function findSongAlbumId(songId: string): Promise<string | null> {
  const libDir = getLibraryDir();
  try {
    const entries = await readdir(libDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fs = await import("fs");
      const songDir = path.join(libDir, entry.name, songId);
      if (fs.existsSync(songDir)) {
        return entry.name;
      }
    }
  } catch {}
  return null;
}
