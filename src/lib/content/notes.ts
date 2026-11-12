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

/** Folder code for a language inside a date folder (en-US -> en). */
function manualLangFolder(lang: string): string {
  return sanitizeId(lang.split('-')[0]);
}

/** `<note>/<date>/`: holds `<lang>/<section>.md` files, the current manual text. */
function manualDateDir(noteId: string, date: string): string {
  return path.join(getNoteDir(sanitizeId(noteId)), date);
}

/** Read the current manual text of a date from its `<lang>/<section>.md` files. */
async function readManualMarkdown(noteId: string, date: string): Promise<NoteManualPeriod | null> {
  const dir = manualDateDir(noteId, date);
  if (!existsSync(dir)) return null;
  const note = await getNote(noteId);
  const sections: Record<string, NoteManualSectionContent> = {};
  let found = false;
  for (const langEntry of await readdir(dir, { withFileTypes: true })) {
    if (!langEntry.isDirectory() || !/^[a-z]{2,3}$/.test(langEntry.name)) continue;
    const lang = toAppCode(langEntry.name);
    for (const file of await readdir(path.join(dir, langEntry.name))) {
      if (!file.endsWith('.md')) continue;
      const key = file.slice(0, -'.md'.length);
      if (!sanitizeId(key) || sanitizeId(key) !== key) continue;
      const text = await readFile(path.join(dir, langEntry.name, file), 'utf-8');
      found = true;
      const section = (sections[key] ??= {});
      section.mdByLanguage = { ...(section.mdByLanguage ?? {}), [lang]: text };
      if (lang === note?.language) section.md = text;
    }
  }
  return found ? { date, sections, modified: undefined } : null;
}

/**
 * Write the manual text of a date as `<note>/<date>/<lang>/<section>.md`.
 * Files for languages that were removed from a section are deleted.
 */
async function writeManualMarkdown(noteId: string, date: string, period: NoteManualPeriod): Promise<void> {
  const id = sanitizeId(noteId);
  const note = await getNote(id);
  const noteLang = note?.language;
  const dir = manualDateDir(id, date);
  const wanted = new Map<string, Set<string>>(); // lang folder -> section file names
  for (const [sectionKey, content] of Object.entries(period.sections)) {
    const safeSection = sanitizeId(sectionKey);
    if (!safeSection) continue;
    const byLang: Record<string, string> = { ...(content.mdByLanguage ?? {}) };
    if (content.md && noteLang && byLang[noteLang] === undefined) byLang[noteLang] = content.md;
    for (const [lang, text] of Object.entries(byLang)) {
      const fileLang = manualLangFolder(lang);
      if (!fileLang) continue;
      const langDir = path.join(dir, fileLang);
      await mkdir(langDir, { recursive: true });
      await writeFile(path.join(langDir, `${safeSection}.md`), text, 'utf-8');
      if (!wanted.has(fileLang)) wanted.set(fileLang, new Set());
      wanted.get(fileLang)!.add(`${safeSection}.md`);
    }
  }
  if (!existsSync(dir)) return;
  for (const langEntry of await readdir(dir, { withFileTypes: true })) {
    if (!langEntry.isDirectory() || !/^[a-z]{2,3}$/.test(langEntry.name)) continue;
    const keep = wanted.get(langEntry.name) ?? new Set<string>();
    for (const file of await readdir(path.join(dir, langEntry.name))) {
      if (file.endsWith('.md') && !keep.has(file)) {
        await rm(path.join(dir, langEntry.name, file), { force: true });
      }
    }
  }
}

export async function getNoteManualPeriod(
  noteId: string,
  date: string,
): Promise<NoteManualPeriod | null> {
  if (!isManualDate(date)) return null;
  const current = await readManualMarkdown(noteId, date);
  if (current) return current;
  // Read-only fallback for content saved before manual text moved to .md files.
  return readManualPeriodFile(manualPeriodPath(sanitizeId(noteId), date), date);
}

export async function listNoteManualDates(noteId: string): Promise<string[]> {
  const id = sanitizeId(noteId);
  const dates = new Set<string>();
  const noteDir = getNoteDir(id);
  if (existsSync(noteDir)) {
    for (const entry of await readdir(noteDir, { withFileTypes: true })) {
      if (entry.isDirectory() && isManualDate(entry.name) && (await readManualMarkdown(id, entry.name))) {
        dates.add(entry.name);
      }
    }
  }
  const legacyDir = getNoteManualDir(id);
  if (existsSync(legacyDir)) {
    for (const entry of await readdir(legacyDir)) {
      if (entry.endsWith('.yaml') && isManualDate(entry.slice(0, -'.yaml'.length))) {
        dates.add(entry.slice(0, -'.yaml'.length));
      }
    }
  }
  return [...dates].sort((a, b) => b.localeCompare(a));
}

/** Legacy YAML history (read-only): new edits no longer create versions. */
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

/** Legacy YAML version (read-only). */
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
