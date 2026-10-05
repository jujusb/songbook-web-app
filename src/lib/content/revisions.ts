import { readdir, readFile, writeFile, mkdir, cp } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Save a revision snapshot of a song translation.
 * Revisions are stored as timestamped copies alongside the .cho file.
 * 
 * Structure:
 *   content/library/<album>/<song>/
 *     en.cho                    # current version
 *     .revisions/
 *       en/
 *         2024-03-01T12-00-00.cho   # revision snapshot
 *         2024-03-02T14-30-00.cho
 */

function getRevisionsDir(songDir: string, lang: string): string {
  return path.join(songDir, '.revisions', lang);
}

export async function saveRevision(
  songDir: string,
  lang: string,
  userId?: string
): Promise<string> {
  const choFile = path.join(songDir, `${lang}.cho`);
  if (!existsSync(choFile)) return '';
  
  const revDir = getRevisionsDir(songDir, lang);
  await mkdir(revDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const revFile = path.join(revDir, `${timestamp}.cho`);
  await cp(choFile, revFile);
  
  return timestamp;
}

export async function listRevisions(
  songDir: string,
  lang: string
): Promise<{ timestamp: string; file: string }[]> {
  const revDir = getRevisionsDir(songDir, lang);
  try {
    const entries = await readdir(revDir);
    return entries
      .filter((f) => f.endsWith('.cho'))
      .sort()
      .reverse()
      .map((f) => {
        const ts = f.replace('.cho', '');
        // Convert from stored format (2024-03-01T12-00-00) back to ISO (2024-03-01T12:00:00)
        const isoTimestamp = ts.replace(/-/g, (match, offset) => {
          if (offset > 13) return ':'; // time part separators
          return '-'; // date part separators
        });
        return { timestamp: isoTimestamp, file: f };
      });
  } catch {
    return [];
  }
}

export async function getRevision(
  songDir: string,
  lang: string,
  file: string
): Promise<string> {
  const revDir = getRevisionsDir(songDir, lang);
  const filePath = path.join(revDir, file);
  return readFile(filePath, 'utf-8');
}
