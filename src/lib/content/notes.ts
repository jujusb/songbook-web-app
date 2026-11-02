import { readFile, writeFile, mkdir, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { getContentDir } from './paths';
import { normalizeNote, type NoteMetadata } from '@/lib/notes';

export function getNotesDir(): string {
  return path.join(getContentDir(), 'notes');
}

export function getNoteDir(noteId: string): string {
  return path.join(getNotesDir(), noteId);
}

export function getNoteConfigPath(noteId: string): string {
  return path.join(getNoteDir(noteId), 'config.yaml');
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

async function listNoteIds(): Promise<string[]> {
  const dir = getNotesDir();
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function getAllNotes(): Promise<NoteMetadata[]> {
  const dir = getNotesDir();
  if (!existsSync(dir)) return [];
  const ids = await listNoteIds();
  const results: NoteMetadata[] = [];
  for (const id of ids) {
    try {
      const note = await getNote(id);
      if (note) results.push(note);
    } catch {
      // skip invalid
    }
  }
  return results;
}

export async function getNote(noteId: string): Promise<NoteMetadata | null> {
  const id = sanitizeId(noteId);
  const p = getNoteConfigPath(id);
  if (!existsSync(p)) return null;
  const raw = await readFile(p, 'utf-8');
  const parsed = yaml.load(raw) as unknown;
  return normalizeNote(parsed as Partial<NoteMetadata>);
}

export async function saveNote(note: Partial<NoteMetadata>): Promise<NoteMetadata> {
  const normalized = normalizeNote({ ...note, created: note.created || new Date().toISOString() });
  const id = sanitizeId(normalized.id) || `note-${Date.now()}`;
  normalized.id = id;
  const noteDir = getNoteDir(id);
  await mkdir(noteDir, { recursive: true });
  const cfg = path.join(noteDir, 'config.yaml');
  await writeFile(cfg, yaml.dump(normalized, { noRefs: true }), 'utf-8');
  // Write date folder with note.md as requested.
  const date = new Date().toISOString().slice(0, 10);
  const dateDir = path.join(noteDir, date);
  await mkdir(dateDir, { recursive: true });
  const sections = (normalized.sections || normalized.content || []).map((s: any) => {
    if (s.type === 'manual') return s.md || '';
    return `(${s.name || 'api'}: ${s.resultSection || ''})`;
  });
  const noteMd = sections.filter(Boolean).join('\n\n');
  await writeFile(path.join(dateDir, 'note.md'), `${normalized.title}\n\n${noteMd}`.trim() + '\n', 'utf-8');
  return normalized;
}

export async function deleteNote(noteId: string): Promise<boolean> {
  const id = sanitizeId(noteId);
  const dir = getNoteDir(id);
  if (!existsSync(dir)) return false;
  await rm(dir, { recursive: true, force: true });
  return true;
}
