import { readFile, writeFile, mkdir, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { getDataDir } from './paths';
import {
  normalizeNote,
  type NoteManualPeriod,
  type NoteManualSectionContent,
  type NoteManualVersionInfo,
  type NoteMetadata,
} from '@/lib/notes';
import { toFileCode, toAppCode } from '@/lib/language-codes';

export function getNotesDir(): string {
  return path.join(getDataDir(), 'notes');
}

export function getNoteDir(noteId: string): string {
  return path.join(getNotesDir(), noteId);
}

export function getNoteConfigPath(noteId: string): string {
  return path.join(getNoteDir(noteId), 'config.yaml');
}

// --- Per-date manual content + history ---
// Current: <data>/notes/<noteId>/manual/<date>.yaml
// History: <data>/notes/<noteId>/manual/<date>/<timestamp>.yaml

const MANUAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getNoteManualDir(noteId: string): string {
  return path.join(getNoteDir(noteId), 'manual');
}

function isManualDate(value: unknown): value is string {
  return typeof value === 'string' && MANUAL_DATE_PATTERN.test(value);
}

function safeVersionLabel(label: string): string {
  if (!/^[a-zA-Z0-9_.-]+$/.test(label) || label.includes('..')) {
    throw new Error('Invalid version label');
  }
  return label;
}

function manualContentKey(period: Pick<NoteManualPeriod, 'sections'>): string {
  return JSON.stringify(period.sections);
}

function normalizeManualSections(input: unknown): Record<string, NoteManualSectionContent> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const result: Record<string, NoteManualSectionContent> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const raw = value as Record<string, unknown>;
    const md = typeof raw.md === 'string' ? raw.md : undefined;
    let mdByLanguage: Record<string, string> | undefined;
    if (raw.mdByLanguage && typeof raw.mdByLanguage === 'object' && !Array.isArray(raw.mdByLanguage)) {
      const entries = Object.entries(raw.mdByLanguage as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string');
      if (entries.length) mdByLanguage = Object.fromEntries(entries) as Record<string, string>;
    }
    result[key] = {
      ...(md !== undefined ? { md } : {}),
      ...(mdByLanguage ? { mdByLanguage } : {}),
    };
  }
  return result;
}

function normalizeManualPeriod(date: string, input: unknown): NoteManualPeriod {
  const raw = input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
  return {
    date,
    sections: normalizeManualSections(raw.sections),
    ...(typeof raw.modified === 'string' ? { modified: raw.modified } : {}),
  };
}

async function readManualPeriodFile(filePath: string, date: string): Promise<NoteManualPeriod | null> {
  if (!existsSync(filePath)) return null;
  try {
    const raw = await readFile(filePath, 'utf-8');
    return normalizeManualPeriod(date, yaml.load(raw));
  } catch {
    return null;
  }
}

function manualPeriodPath(noteId: string, date: string): string {
  return path.join(getNoteManualDir(noteId), `${date}.yaml`);
}

function manualVersionsDir(noteId: string, date: string): string {
  return path.join(getNoteManualDir(noteId), date);
}

async function readManualVersion(
  noteId: string,
  date: string,
  label: string,
): Promise<NoteManualPeriod | null> {
  const safe = safeVersionLabel(label);
  return readManualPeriodFile(
    path.join(manualVersionsDir(sanitizeId(noteId), date), `${safe}.yaml`),
    date,
  );
}

async function uniqueManualVersionLabel(noteId: string, date: string): Promise<string> {
  const dir = manualVersionsDir(noteId, date);
  const base = new Date().toISOString().replace(/[:.]/g, '-');
  let label = base;
  let counter = 2;
  while (existsSync(path.join(dir, `${label}.yaml`))) {
    label = `${base}-${counter++}`;
  }
  return label;
}

async function findManualVersionWithKey(
  noteId: string,
  date: string,
  key: string,
): Promise<string | null> {
  const dir = manualVersionsDir(noteId, date);
  if (!existsSync(dir)) return null;
  const entries = await readdir(dir);
  for (const entry of entries) {
    if (!entry.endsWith('.yaml')) continue;
    const label = entry.slice(0, -'.yaml'.length);
    const period = await readManualVersion(noteId, date, label);
    if (period && manualContentKey(period) === key) return label;
  }
  return null;
}

async function archiveManualPeriod(
  noteId: string,
  date: string,
  period: NoteManualPeriod,
): Promise<void> {
  const key = manualContentKey(period);
  if (await findManualVersionWithKey(noteId, date, key)) return;
  const label = await uniqueManualVersionLabel(noteId, date);
  const dir = manualVersionsDir(noteId, date);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${label}.yaml`), yaml.dump(period, { noRefs: true }), 'utf-8');
}

export async function getNoteManualPeriod(
  noteId: string,
  date: string,
): Promise<NoteManualPeriod | null> {
  if (!isManualDate(date)) return null;
  return readManualPeriodFile(manualPeriodPath(sanitizeId(noteId), date), date);
}

export async function listNoteManualDates(noteId: string): Promise<string[]> {
  const dir = getNoteManualDir(sanitizeId(noteId));
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries
    .filter((entry) => entry.endsWith('.yaml'))
    .map((entry) => entry.slice(0, -'.yaml'.length))
    .filter(isManualDate)
    .sort((a, b) => b.localeCompare(a));
}

export async function listNoteManualVersions(
  noteId: string,
  date: string,
): Promise<NoteManualVersionInfo[]> {
  if (!isManualDate(date)) return [];
  const dir = manualVersionsDir(sanitizeId(noteId), date);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  const versions: NoteManualVersionInfo[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.yaml')) continue;
    const label = entry.slice(0, -'.yaml'.length);
    const period = await readManualVersion(noteId, date, label);
    if (period) versions.push({ label, date, modified: period.modified });
  }
  return versions.sort((a, b) => b.label.localeCompare(a.label));
}

export async function getNoteManualVersion(
  noteId: string,
  date: string,
  label: string,
): Promise<NoteManualPeriod> {
  if (!isManualDate(date)) throw new Error('Invalid date');
  const period = await readManualVersion(sanitizeId(noteId), date, label);
  if (!period) throw new Error('Version not found');
  return period;
}

/**
 * Mirror the current manual text of a date into plain markdown files:
 * `<note>/<date>/<lang>/<section>.md` (lang uses the file code, e.g. `en`).
 */
async function writeManualMarkdown(noteId: string, date: string, period: NoteManualPeriod): Promise<void> {
  const id = sanitizeId(noteId);
  const note = await getNote(id);
  const noteLang = note?.language;
  for (const [sectionKey, content] of Object.entries(period.sections)) {
    const safeSection = sanitizeId(sectionKey);
    if (!safeSection) continue;
    const byLang: Record<string, string> = { ...(content.mdByLanguage ?? {}) };
    if (content.md && noteLang && byLang[noteLang] === undefined) byLang[noteLang] = content.md;
    for (const [lang, text] of Object.entries(byLang)) {
      // Folder code is the short language (en-US -> en), like the .cho files.
      const fileLang = sanitizeId(lang.split('-')[0]);
      if (!fileLang) continue;
      const dir = path.join(getNoteDir(id), date, fileLang);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${safeSection}.md`), text, 'utf-8');
    }
  }
}

export async function saveNoteManualPeriod(
  noteId: string,
  date: string,
  sections: Record<string, NoteManualSectionContent>,
): Promise<NoteManualPeriod> {
  if (!isManualDate(date)) throw new Error('Invalid date');
  const id = sanitizeId(noteId);
  if (!existsSync(getNoteConfigPath(id))) throw new Error('Note not found');

  const next: NoteManualPeriod = {
    date,
    sections: normalizeManualSections(sections),
    modified: new Date().toISOString(),
  };
  const current = await readManualPeriodFile(manualPeriodPath(id, date), date);
  if (current && manualContentKey(current) !== manualContentKey(next)) {
    await archiveManualPeriod(id, date, current);
  }

  await mkdir(getNoteManualDir(id), { recursive: true });
  await writeFile(manualPeriodPath(id, date), yaml.dump(next, { noRefs: true }), 'utf-8');
  await writeManualMarkdown(id, date, next);
  return next;
}

export async function restoreNoteManualVersion(
  noteId: string,
  date: string,
  label: string,
): Promise<NoteManualPeriod> {
  if (!isManualDate(date)) throw new Error('Invalid date');
  const id = sanitizeId(noteId);
  const target = await getNoteManualVersion(id, date, label);
  const current = await readManualPeriodFile(manualPeriodPath(id, date), date);
  if (current && manualContentKey(current) !== manualContentKey(target)) {
    await archiveManualPeriod(id, date, current);
  }
  await mkdir(getNoteManualDir(id), { recursive: true });
  await writeFile(manualPeriodPath(id, date), yaml.dump(target, { noRefs: true }), 'utf-8');
  await writeManualMarkdown(id, date, target);
  return target;
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
  const parsed = yaml.load(raw) as Partial<NoteMetadata> | null;
  return normalizeNote({
    ...(parsed as object),
    ...(parsed?.language != null ? { language: toAppCode(parsed.language) } : {}),
  });
}

export async function saveNote(note: Partial<NoteMetadata>): Promise<NoteMetadata> {
  const normalized = normalizeNote({ ...note, created: note.created || new Date().toISOString() });
  normalized.language = toFileCode(normalized.language);
  const usedSectionIds = new Set<string>();
  normalized.sections = normalized.sections.map((section, index) => {
    if (section.type !== 'manual') return section;
    let id = section.id;
    if (!id || usedSectionIds.has(id)) {
      id = `section-${index}`;
      let counter = 2;
      while (usedSectionIds.has(id)) id = `section-${index}-${counter++}`;
    }
    usedSectionIds.add(id);
    return id === section.id ? section : { ...section, id };
  });
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
  const sections = (normalized.sections || normalized.content || []).map((s) => {
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
