import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { SongListItem } from '@/lib/content';
import type { Partition } from '@/lib/content/schemas';

export interface PartitionFile {
  instrument: string;
  instrumentLabel: string;
  file: string;
  title: string;
}

export interface PartitionMatch {
  songId: string;
  title: string;
  partitions: Partition[];
}

export function getPartitionsDir(): string {
  return process.env.PARTITIONS_DIR || path.join(process.cwd(), 'public', 'partitions');
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function decodeFileName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/**
 * Normalize a name for matching: strip accents, lowercase, collapse
 * punctuation/emojis into single spaces.
 */
function normalizeName(name: string): string {
  return decodeFileName(name)
    .replace(/\.pdf$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Strict word-boundary substring match: `needle` must appear as a contiguous,
 * whole-phrase substring of `haystack` (both normalized).
 */
function includesPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const before = idx === 0 || haystack[idx - 1] === ' ';
  const after =
    idx + needle.length >= haystack.length || haystack[idx + needle.length] === ' ';
  return before && after;
}

async function walkDir(
  dir: string,
  rel: string,
  instrument: string,
  instrumentLabel: string,
  files: PartitionFile[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, entryRel, instrument, instrumentLabel, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      files.push({
        instrument,
        instrumentLabel,
        file: entryRel,
        title: decodeFileName(entry.name.replace(/\.pdf$/i, '')),
      });
    }
  }
}

/**
 * Scan the partitions directory for PDF files. Top-level subdirectories are
 * treated as instruments; PDFs at the root belong to instrument "otros".
 */
export async function scanPartitionFiles(): Promise<PartitionFile[]> {
  const root = getPartitionsDir();
  if (!existsSync(root)) return [];

  const files: PartitionFile[] = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await walkDir(
        fullPath,
        entry.name,
        slugify(entry.name),
        decodeFileName(entry.name),
        files,
      );
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      files.push({
        instrument: 'otros',
        instrumentLabel: 'Otros',
        file: entry.name,
        title: decodeFileName(entry.name.replace(/\.pdf$/i, '')),
      });
    }
  }
  files.sort((a, b) => a.file.localeCompare(b.file));
  return files;
}

/**
 * Match the available partition PDFs against songs. A PDF matches a song when
 * any of the song's titles (default title + per-language `titles` values)
 * appears as a strict word-boundary substring of the normalized filename.
 */
export async function matchPartitions(
  songs: SongListItem[],
): Promise<PartitionMatch[]> {
  const files = await scanPartitionFiles();
  if (files.length === 0) return [];

  const matches: PartitionMatch[] = [];
  for (const song of songs) {
    const candidates = new Set(
      [song.title, ...Object.values(song.titles ?? {})]
        .map(normalizeName)
        .filter(Boolean),
    );

    const seen = new Set<string>();
    const partitions: Partition[] = [];
    for (const file of files) {
      const fileName = normalizeName(file.title);
      let matched = false;
      for (const candidate of candidates) {
        if (includesPhrase(fileName, candidate)) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
      const key = `${file.instrument}::${file.file}`;
      if (seen.has(key)) continue;
      seen.add(key);
      partitions.push({
        instrument: file.instrument,
        instrumentLabel: file.instrumentLabel,
        file: file.file,
        title: file.title,
      });
    }

    if (partitions.length > 0) {
      matches.push({ songId: song.id, title: song.title, partitions });
    }
  }
  matches.sort((a, b) => a.title.localeCompare(b.title));
  return matches;
}