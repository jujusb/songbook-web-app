import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Filesystem locations of the content tree.
 *
 * These live in their own module so that `revisions.ts` can resolve paths
 * without importing `index.ts` — `index.ts` imports the revision helpers, and
 * a cycle between the two would make the module init order significant.
 */

export function getContentDir(): string {
  return path.join(process.cwd(), 'content');
}

export function getLibraryDir(): string {
  return path.join(getContentDir(), 'library');
}

/**
 * Find the folder of a song anywhere in the library.
 * Songs live at `content/library/<album-id>/<song-id>/`, and song ids are
 * unique across albums.
 */
export async function findSongPath(songId: string): Promise<string | null> {
  const libDir = getLibraryDir();
  try {
    const albumDirs = await readdir(libDir, { withFileTypes: true });
    for (const albumDir of albumDirs) {
      if (!albumDir.isDirectory()) continue;
      const songDir = path.join(libDir, albumDir.name, songId);
      if (existsSync(songDir)) {
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
    const albumDirs = await readdir(libDir, { withFileTypes: true });
    for (const albumDir of albumDirs) {
      if (!albumDir.isDirectory()) continue;
      const songDir = path.join(libDir, albumDir.name, songId);
      if (existsSync(songDir)) {
        return albumDir.name;
      }
    }
  } catch {}
  return null;
}
