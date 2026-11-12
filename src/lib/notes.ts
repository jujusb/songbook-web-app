/** 
 * Recurrent Notes Management 
 * Manages recurrent notes with API integration and markdown content 
 */
 
// Note structure and types
import { toAppCode, toFileCode } from './language-codes';
export type NotePeriodicBehavior = 'same' | 'different_per_period';

export interface NoteOrderedField {
  name: string;
  style?: string;
  label?: string;
  fallback?: string;
}

export interface NoteDiscriminatorValue {
  name: string;
  style?: string;
  fieldsOrdered?: NoteOrderedField[];
  fields?: NoteOrderedField[];
}

export interface NoteSection {
  type: 'manual' | 'api';
  /** Stable key for per-date manual content (manual sections only). */
  id?: string;
  typeStyles?: Record<string, string>;
  typeVisibility?: Record<string, boolean>;
  typeConfigs?: Record<string, { fieldOrder?: string[]; fieldStyles?: Record<string, string>; showDiscriminator?: boolean; typeStyles?: Record<string, string> }>;
  discriminator?: string;
  fieldOrder?: string[];
  fieldStyles?: Record<string, string>;
  allFields?: string[];
  discriminatorValues?: NoteDiscriminatorValue[];
  rawDiscriminatorValues?: string[];
  showDiscriminator?: boolean;
  md?: string;
  mdByLanguage?: Record<string, string>;
  fields?: NoteOrderedField[];
  name?: string;
  api_url?: string;
  resultSection?: string;
  authorization?: string;
  languages?: string[];
  periodic_behavior?: NotePeriodicBehavior;
}

// Backwards-compatible alias for the previous name.
export type NoteContent = NoteSection;

export interface NoteApiSource {
  name: string;
  api_url: string;
  resultSection?: string;
  authorization?: string;
  languages?: string[];
}

/** Manual text for one section on one date. */
export interface NoteManualSectionContent {
  md?: string;
  mdByLanguage?: Record<string, string>;
}

/** Current manual content for one occurrence date. */
export interface NoteManualPeriod {
  date: string;
  sections: Record<string, NoteManualSectionContent>;
  modified?: string;
}

export interface NoteManualVersionInfo {
  label: string;
  date: string;
  modified?: string;
}

/** Stable key used to store per-date content for a manual section. */
export function noteManualSectionKey(section: NoteSection, index: number): string {
  return section.id || `section-${index}`;
}

/**
 * Languages a manual text part can be written in: the note's "API applicable
 * languages" (set on its API sections), restricted to the configured site
 * languages and kept in site order. Empty selection means all site languages.
 */
export function noteApplicableLanguages(
  sections: NoteSection[] | undefined,
  siteLanguages: string[],
): string[] {
  const api = (sections || []).find((s) => s.type === 'api' && (s.languages?.length ?? 0) > 0);
  if (!api?.languages) return siteLanguages;
  const selected = new Set(api.languages);
  const filtered = siteLanguages.filter((lang) => selected.has(lang));
  return filtered.length > 0 ? filtered : siteLanguages;
}

export interface NoteMetadata {
  id: string;
  title: string;
  language: string;
  recurrent_type: 'weekly' | 'monthly' | 'specific-dates' | 'daily';
  recurrent_schedule: string;
  periodic_behavior: 'same' | 'different_per_period';
  // A note is an ordered list of sections; each section is either manual
  // text or a call to an external API.
  sections: NoteSection[];
  // Alias kept for backwards compatibility (not persisted).
  content?: NoteSection[];
  // Legacy aggregate fields, derived from `sections`.
  api_source: 'manual' | 'api' | 'custom';
  api_sources: NoteApiSource[];
  last_fetched?: string;
  last_edited?: string;
  created: string;
  tags: string[];
  periodOverrides?: Record<string, string>;
  published?: boolean;
  publishedDates?: string[];
}
 
// API Configuration
export interface NotesApiConfig {
  enabled: boolean;
  defaultEndpoint: string;
  defaultLanguages: string;
  defaultFrequency: 'daily' | 'weekly' | 'monthly';
  defaultResultRetention: 'this-day' | 'weekly' | 'monthly';
  customEndpoints: Array<{
    name: string;
    endpoint: string;
    languages: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    resultRetention: 'this-day' | 'weekly' | 'monthly';
  }>;
}
 
// Note Storage
export interface NotesStorage {
  [noteId: string]: NoteMetadata;
}
 
// Search Results
export interface NoteSearchResult {
  noteId: string;
  title: string;
  language: string;
  recurrentType: string;
  snippet: string;
  highlightTerms: string[];
}
 
// API Response Types
export interface NoteApiResponse {
  success: boolean;
  note?: NoteMetadata;
  error?: string;
  data?: NoteMetadata[];
}
 
// Storage helpers
function getStorageFromLocal(): NotesStorage {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    const stored = localStorage.getItem('songbook_notes_storage');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse notes storage', e);
      }
    }
  }
  return {};
}
 
function saveStorageToLocal(storage: NotesStorage): void {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    localStorage.setItem('songbook_notes_storage', JSON.stringify(storage));
  }
}
 

function toApiSources(sections: NoteSection[]): NoteApiSource[] {
  return sections
    .filter((s) => s.type === 'api')
    .map((s) => ({
      name: s.name || 'custom-api',
      api_url: s.api_url || '',
      resultSection: s.resultSection,
      authorization: s.authorization,
      languages: s.languages,
    }));
}

function deriveApiSource(sections: NoteSection[], fallback?: NoteMetadata['api_source']): NoteMetadata['api_source'] {
  if (fallback === 'custom') return 'custom';
  if (sections.some((s) => s.type === 'api')) return fallback === 'manual' ? 'manual' : 'api';
  return fallback || 'manual';
}

function migrateSection(sec: any): NoteSection {
  const s = { ...sec } as NoteSection;
  if (s.type === 'api') {
    if (!Array.isArray(s.fields) && s.discriminator === 'none' && Array.isArray(s.fieldOrder)) {
      s.fields = s.fieldOrder.map((k) => ({ name: k, style: s.fieldStyles?.[k] || 'plain' }));
    }
    if (!Array.isArray(s.discriminatorValues) && s.discriminator && s.discriminator !== 'none') {
      const types = (s.typeStyles || {}) as Record<string, string>;
      const configs = (s.typeConfigs || {}) as Record<string, any>;
      const keys = s.typeStyles ? Object.keys(s.typeStyles) : [];
      const fromConfigs = Object.keys(configs);
      const bases = fromConfigs.length ? fromConfigs : keys;
      if (!bases.length && Array.isArray(s.fieldOrder)) bases.push('type');
      s.discriminatorValues = bases.map((base) => {
        const cfg = configs[base] || {};
        const order = Array.isArray(cfg.fieldOrder) ? cfg.fieldOrder : s.fieldOrder || [];
        return {
          name: base,
          style: s.typeStyles?.[base] || 'plain',
          fieldsOrdered: order.map((k: string) => ({ name: k, style: cfg.fieldStyles?.[k] || s.fieldStyles?.[k] || 'plain' })),
        };
      });
    }
  }
  return s;
}

function normalizeSections(note: Partial<NoteMetadata>): NoteSection[] {
  let sections: NoteSection[] | null = null;
  if (Array.isArray(note.sections)) sections = note.sections as NoteSection[];
  else if (Array.isArray(note.content)) sections = note.content as NoteSection[];
  else if (Array.isArray(note.api_sources)) {
    const apis = note.api_sources as NoteApiSource[];
    if (apis.length > 0) {
      sections = apis.map((s) => ({
        type: 'api' as const,
        name: s.name,
        api_url: s.api_url,
        resultSection: s.resultSection,
        authorization: s.authorization,
        languages: s.languages,
      }));
    }
  }
  return (sections ?? []).map((s) => migrateSection(s));
}

export function normalizeNote(note: Partial<NoteMetadata>): NoteMetadata {
  const sections = normalizeSections(note);
  const apiSources =
    Array.isArray(note.api_sources) && (note.api_sources as unknown[]).length > 0
      ? (note.api_sources as NoteApiSource[])
      : toApiSources(sections);
  const apiSource = deriveApiSource(sections, note.api_source as NoteMetadata['api_source'] | undefined);
  return {
    id: (note.id as string) || `note-${Date.now()}`,
    title: (note.title as string) || '',
    language: toAppCode((note.language as string) || 'en-US'),
    recurrent_type: (note.recurrent_type as NoteMetadata['recurrent_type']) || 'weekly',
    recurrent_schedule: (note.recurrent_schedule as string) || 'sunday',
    periodic_behavior: (note.periodic_behavior as NoteMetadata['periodic_behavior']) || 'same',
    sections,
    api_source: apiSource,
    api_sources: apiSources,
    last_fetched: note.last_fetched as string | undefined,
    last_edited: note.last_edited as string | undefined,
    created: (note.created as string) || new Date().toISOString(),
    tags: (note.tags as string[]) || [],
    published: (note.published as boolean) || false,
    publishedDates: (note.publishedDates as string[]) || [],
    periodOverrides: note.periodOverrides as Record<string, string> | undefined,
  };
}

/**
 * Pick the language to use for a note part.
 * Empty/undefined applicable languages mean "all languages", so the preferred
 * language (usually the UI locale) wins. Otherwise the preferred language is
 * used when applicable, then the note language when applicable, and finally
 * the first configured language.
 */
export function resolveNoteLanguage(
  noteLanguage: string | undefined,
  applicableLanguages: string[] | undefined,
  preferredLanguage: string | undefined,
): string | undefined {
  const applicable = (applicableLanguages || []).filter(Boolean);
  if (applicable.length === 0) {
    return preferredLanguage || noteLanguage;
  }
  if (preferredLanguage && applicable.includes(preferredLanguage)) {
    return preferredLanguage;
  }
  if (noteLanguage && applicable.includes(noteLanguage)) {
    return noteLanguage;
  }
  return applicable[0];
}

// Initialize storage
const storage = getStorageFromLocal();
export const notesStorage = storage;
 
// Notes API module - named export for route imports
export const notesApi = {
  fetchNotes: async (): Promise<NoteMetadata[]> => {
    const res = await fetch('/api/notes');
    if (!res.ok) return [];
    return res.json();
  },
  fetchNote: async (noteId: string): Promise<NoteMetadata | null> => {
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`);
    if (!res.ok) return null;
    return res.json();
  },
  createNote: async (note: Partial<NoteMetadata>): Promise<NoteMetadata> => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    if (!res.ok) throw new Error('Failed to create note');
    return res.json();
  },
  updateNote: async (noteId: string, updates: Partial<NoteMetadata>): Promise<NoteMetadata> => {
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update note');
    return res.json();
  },
  deleteNote: async (noteId: string): Promise<boolean> => {
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  },
  searchNotes: async (query: string, filters?: { recurrentType?: string; language: string }): Promise<NoteSearchResult[]> => {
    const notes = await notesApi.fetchNotes();
    const results: NoteSearchResult[] = [];
    for (const note of notes) {
      const matchesTitle = note.title.toLowerCase().includes(query.toLowerCase());
      const matchesLanguage = filters?.language ? note.language === filters.language : true;
      const matchesRecurrentType = filters?.recurrentType ? note.recurrent_type === filters.recurrentType : true;
      if (matchesTitle || matchesLanguage || matchesRecurrentType) {
        results.push({
          noteId: note.id,
          title: note.title,
          language: note.language,
          recurrentType: note.recurrent_type,
          snippet: (note.sections || note.content || []).length > 0 ? ((note.sections || note.content || [])[0].md || note.title.substring(0, 100)) : '',
          highlightTerms: [query],
        });
      }
    }
    return results.slice(0, 10);
  },
  getAllNotes: async (): Promise<NoteMetadata[]> => {
    return notesApi.fetchNotes();
  },
} as const;


// --- External API helpers (date + nested JSON extraction) ---

export type NoteApiContext = {
  lang?: string;
  date?: Date | string;
  dateFormat?: string;
};

export type NoteApiField = string | { key?: string; path?: string; field?: string; name?: string; label?: string; style?: string; fallback?: string };

function toDate(value: Date | string | undefined): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function formatDate(date: Date, format: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = months.map((m) => m.slice(0, 3));
  return format
    .replace(/YYYY/g, String(date.getFullYear()))
    .replace(/YY/g, String(date.getFullYear()).slice(-2))
    .replace(/MMMM/g, months[date.getMonth()])
    .replace(/MMM/g, shortMonths[date.getMonth()])
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/DD/g, pad(date.getDate()))
    .replace(/HH/g, pad(date.getHours()))
    .replace(/mm/g, pad(date.getMinutes()))
    .replace(/ss/g, pad(date.getSeconds()));
}

export function interpolateApiUrl(template: string, context: NoteApiContext = {}): string {
  const date = toDate(context.date);
  const lang = context.lang || '';
  const defaultFormat = context.dateFormat || 'YYYY-MM-DD';

  let result = template;

  // ${DATE:format}
  result = result.replace(/\$\{DATE:([^}]+)\}/g, (_, format) => formatDate(date, format.trim()));
  // ${DATE(format)}
  result = result.replace(/\$\{DATE\(([^)]+)\)\}/g, (_, format) => formatDate(date, format.trim()));
  // $DATE(format)
  result = result.replace(/\$DATE\(([^)]+)\)/g, (_, format) => formatDate(date, format.trim()));
  // $DATE:format (until whitespace or end)
  result = result.replace(/\$DATE:([^\s)]+)/g, (_, format) => formatDate(date, format.trim()));

  // Plain date token
  result = result.replace(/\$\{DATE\}|\$DATE/g, () => formatDate(date, defaultFormat));
  result = result.replace(/\$\{LANG_SHORT\}|\$LANG_SHORT/g, () => (lang ? toFileCode(lang) : ''));
  result = result.replace(/\$\{LANG\}|\$LANG/g, () => lang);

  return result;
}

export const buildNoteApiUrl = interpolateApiUrl;
export const interpolateNoteUrl = interpolateApiUrl;

/** Replace language placeholders in a JSON path or result section. */
export function interpolateLanguagePath(path: string, lang?: string): string {
  if (!path || !lang) return path;
  return path
    .replace(/\$\{LANG_SHORT\}|\$LANG_SHORT/g, () => toFileCode(lang))
    .replace(/\$\{LANG\}|\$LANG/g, () => lang);
}

export function getNestedValue(data: unknown, path?: string, lang?: string): unknown {
  if (!path || path.trim() === '') return data;
  const cleaned = interpolateLanguagePath(path.trim(), lang).replace(/\[\]/g, '[]'); // normalize
  // Tokenize, preserving [] and [..] blocks.
  const tokens = cleaned.match(/\[\]|\[[^\]]*\]|[^.\[\]]+/g) || [];
  function walk(current: unknown, rest: string[]): unknown[] {
    if (rest.length === 0) return [current];
    const token = rest[0];
    const tail = rest.slice(1);
    if (token === '[]') {
      if (Array.isArray(current)) return current.flatMap((item) => walk(item, tail));
      return [];
    }
    const bracket = token.match(/^\[(.*)\]$/);
    if (bracket) {
      const inner = bracket[1].trim();
      if (/^-?\d+$/.test(inner)) {
        if (Array.isArray(current)) {
          const v = current[Number(inner)];
          if (v === undefined) return [];
          return walk(v, tail);
        }
        return [];
      }
      const eq = inner.match(/^([^=]+)=(.+)$/);
      if (eq) {
        if (Array.isArray(current)) {
          const key = eq[1].trim();
          const value = eq[2].trim().replace(/^['"]|['"]$/g, '');
          const filtered = current.filter((item) => {
            if (!item || typeof item !== 'object') return false;
            return String((item as Record<string, unknown>)[key]) === value;
          });
          if (tail.length === 0) return filtered;
          return filtered.flatMap((item) => walk(item, tail));
        }
        return [];
      }
      if (current && typeof current === 'object') {
        return walk((current as Record<string, unknown>)[inner], tail);
      }
      return [];
    }
    if (Array.isArray(current)) {
      return current.flatMap((item) => {
        if (item && typeof item === 'object') {
          return walk((item as Record<string, unknown>)[token], tail);
        }
        return [];
      });
    }
    if (current && typeof current === 'object') {
      return walk((current as Record<string, unknown>)[token], tail);
    }
    return [];
  }
  const values = walk(data, tokens);
  if (values.length === 0) return undefined;
  if (values.length === 1) return values[0];
  return values;
}

export const getJsonPath = getNestedValue;
export const extractJsonPath = getNestedValue;
export const resolveJsonPath = getNestedValue;

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

export const STYLE_MAP: Record<string, (text: string) => string> = {
  bold: (t) => `**${t}**`,
  italic: (t) => `_${t}_`,
  underline: (t) => `__${t}__`,
  h1: (t) => `# ${t}`,
  h2: (t) => `## ${t}`,
  h3: (t) => `### ${t}`,
  quote: (t) => t.split('\n').map((l) => `> ${l}`).join('\n'),
  code: (t) => `\`${t}\``,
  plain: (t) => t,
};

function applyStyle(text: string, style?: string): string {
  if (!text || !text.trim()) return '';
  if (!style) return text;
  if (style.toLowerCase() === 'none' || style.toLowerCase() === 'hidden' || style.toLowerCase() === 'skip') return '';
  const fn = STYLE_MAP[style.toLowerCase()];
  return fn ? fn(text) : text;
}

function fieldKey(field: NoteApiField): string {
  if (typeof field === 'string') return field;
  return field.key || field.path || field.field || field.name || '';
}

export const TYPE_STYLE_MAP: Record<string, string> = {
  titre: 'h2',
  title: 'h2',
  heading: 'h2',
  sous_titre: 'h3',
  subtitle: 'h3',
};

function stripHtmlTags(value: string): string {
  return value.replace(/<\/?[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

/** French liturgical texts put a blank line between each line; other languages keep single line breaks. */
function normalizeLineSpacing(value: string, lang?: string): string {
  const single = value.replace(/\r\n/g, '\n').replace(/\n+/g, '\n');
  return lang && /^fr\b/i.test(lang) ? single.replace(/\n/g, '\n\n') : single;
}


export function getApiResultKeys(data: unknown, resultSection?: string, lang?: string): string[] {
  const target = getNestedValue(data, resultSection, lang);
  const collect = (obj: unknown): string[] => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.keys(obj as Record<string, unknown>).filter((k) => {
        const v = (obj as Record<string, unknown>)[k];
        if (v === null || v === undefined) return false;
        if (v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      });
    }
    return [];
  };
  if (Array.isArray(target)) {
    const keys = new Set<string>();
    for (const item of target) for (const k of collect(item)) keys.add(k);
    return [...keys];
  }
  return collect(target);
}

function normalizeDiscriminatorValue(value: unknown): string {
  const raw = String(value ?? '');
  return raw.replace(/_\d+$/, '');
}

export function extractApiSectionText(rawSection0: Partial<NoteSection>, data: unknown, lang?: string): string {
  // Use the saved shape directly (fields / discriminatorValues) while keeping
  // backward compatibility with legacy structures.
  const working: Record<string, unknown> = { ...rawSection0 };
  const reqFields = (rawSection0 as Record<string, unknown>).fields;
  const reqDvs = (rawSection0 as Record<string, unknown>).discriminatorValues;
  if (Array.isArray(reqFields)) {
    working.fieldOrder = (working.fieldOrder as string[] | undefined) || reqFields.map((f: any) => f.name);
    working.fieldStyles = working.fieldStyles || Object.fromEntries(reqFields.map((f: any) => [f.name, f.style || 'plain']));
    working.allFields = working.allFields || (working.fieldOrder as string[]);
  }
  if (Array.isArray(reqDvs)) {
    const types: Record<string, string> = (working.typeStyles as Record<string, string>) || {};
    const configs: Record<string, any> = (working.typeConfigs as Record<string, any>) || {};
    for (const dv of reqDvs as any[]) {
      types[dv.name] = dv.style || types[dv.name] || 'plain';
      configs[dv.name] = {
        fieldOrder: dv.fieldsOrdered ? dv.fieldsOrdered.map((f: any) => f.name) : [],
        fieldStyles: Object.fromEntries((dv.fieldsOrdered || dv.fields || []).map((f: any) => [f.name, f.style || 'plain'])),
        showDiscriminator: working.showDiscriminator,
      };
    }
    working.typeStyles = types;
    working.typeConfigs = configs;
    if (!working.discriminatorValues) working.discriminatorValues = reqDvs;
  }
  const rawSection2: Partial<NoteSection> = working as Partial<NoteSection>;  

  // use rawSection2 from here
  const discKey = interpolateLanguagePath(
    String((rawSection2 as Record<string, unknown>).discriminator || (rawSection2 as Record<string, unknown>).typeField || 'type'),
    lang,
  );
  const rawSection = rawSection2;
  const rawSectionTmp = rawSection;

  const rawDiscValue =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)[discKey]
      : undefined;
  const typeConfigs = (rawSection as Record<string, unknown>).typeConfigs as Record<string, unknown> | undefined;
  const normalizedRawDisc = normalizeDiscriminatorValue(rawDiscValue);
  const cfg =
    rawDiscValue != null && typeConfigs && (typeConfigs[normalizedRawDisc] || typeConfigs[String(rawDiscValue)])
      ? (typeConfigs[normalizedRawDisc] || typeConfigs[String(rawDiscValue)]) as Record<string, unknown>
      : {};
  const section: Partial<NoteSection> = {
    ...rawSection,
    discriminator: discKey,
    fieldOrder: (cfg as Record<string, unknown>).fieldOrder as string[] | undefined || (rawSection as Record<string, unknown>).fieldOrder as string[] | undefined,
    fieldStyles: {
      ...((rawSection as Record<string, unknown>).fieldStyles as Record<string, string> | undefined || {}),
      ...((cfg as Record<string, unknown>).fieldStyles as Record<string, string> | undefined || {}),
    },
    showDiscriminator:
      (cfg as Record<string, unknown>).showDiscriminator as boolean | undefined ??
      (rawSection as Record<string, unknown>).showDiscriminator as boolean | undefined,
    typeStyles: {
      ...((rawSection as Record<string, unknown>).typeStyles as Record<string, string> | undefined || {}),
      ...((cfg as Record<string, unknown>).typeStyles as Record<string, string> | undefined || {}),
    },
  };
  const resultSection =
    (section as Record<string, unknown>).resultSection || (section as Record<string, unknown>).resultPath || (section as Record<string, unknown>).result_path;
  const source = getNestedValue(data, resultSection as string | undefined, lang);

  const fields =
    (section as Record<string, unknown>).fields ||
    (section as Record<string, unknown>).resultFields ||
    (section as Record<string, unknown>).selectedFields ||
    (section as Record<string, unknown>).selected_fields ||
    [];

  const order =
    (section as Record<string, unknown>).order ||
    (section as Record<string, unknown>).fieldOrder ||
    (section as Record<string, unknown>).resultOrder ||
    [];

  const styles =
    (section as Record<string, unknown>).styles ||
    (section as Record<string, unknown>).fieldStyles ||
    (section as Record<string, unknown>).resultStyles ||
    {};

  const typeStyles =
    (section as Record<string, unknown>).typeStyles ||
    (section as Record<string, unknown>).type_styles ||
    {};

  const discriminator = String(
    (section as Record<string, unknown>).discriminator ||
      (section as Record<string, unknown>).typeField ||
      "type"
  );

  const fieldOrder =
    (section as Record<string, unknown>).fieldOrder ||
    (section as Record<string, unknown>).field_order;

  const fieldStyles =
    (section as Record<string, unknown>).fieldStyles ||
    (section as Record<string, unknown>).field_styles ||
    {};

  const template = (section as Record<string, unknown>).displayTemplate || (section as Record<string, unknown>).template || (section as Record<string, unknown>).display;

  // If a display template is provided, render placeholders.
  const normalizedDisc = String((section as any).discriminator || 'none');
  if (normalizedDisc !== 'none' && data && typeof data === 'object' && !Array.isArray(data)) {
    const rawType = (data as Record<string, unknown>)[normalizedDisc];
    const normalizedType = normalizeDiscriminatorValue(rawType);
    const dv = ((section as Record<string, unknown>).discriminatorValues as Array<any> | undefined)?.find((d) => normalizeDiscriminatorValue(d.name) === normalizedType);
    const tv = (section as Record<string, unknown>).typeVisibility as Record<string, boolean> | undefined;
    if (dv && (tv?.[normalizedType] === false || String(dv.style || '').toLowerCase() === 'none')) return '';
  }

  const target = source === undefined ? data : source;

  // Arrays (e.g. messes.lectures or messes.lectures[]): render each element,
  // using its `type` field to decide how the content is displayed.
  if (Array.isArray(target)) {
    const { resultSection: _a, resultPath: _b, result_path: _c, ...rest } = section as Record<string, unknown>;
    const discriminator = String((section as Record<string, unknown>).discriminator || (section as Record<string, unknown>).typeField || 'type');
    const order = (section as Record<string, unknown>).typeStyleOrder;
    const tv = (section as Record<string, unknown>).typeVisibility as Record<string, boolean> | undefined;
    // Skip items whose type is hidden or styled as 'none'
    const workingTarget = target.filter((item) => {
      if (!item || typeof item !== 'object') return true;
      const nt = normalizeDiscriminatorValue((item as Record<string, unknown>)[discriminator]);
      const ts = (section as Record<string, unknown>).typeStyles as Record<string, string> | undefined;
      if (tv && tv[nt] === false) return false;
      if (tv && tv[String((item as Record<string, unknown>)[discriminator])] === false) return false;
      const style = String(ts?.[nt] ?? ts?.[String((item as Record<string, unknown>)[discriminator])] ?? '').toLowerCase();
      return style !== 'none';
    });
    const joined = workingTarget
      .map((item) => extractApiSectionText(rest as Partial<NoteSection>, item, lang))
      .filter(Boolean)
      .join('\n');
    return normalizeLineSpacing(joined, lang);
  }

  // Determine field list
  let fieldList: Array<{ key: string; style?: string; label?: string; fallback?: string }>;
  if (Array.isArray(fields) && fields.length > 0) {
    fieldList = (fields as NoteApiField[]).map((f) => {
      const elementType = target && typeof target === 'object' && !Array.isArray(target) ? (target as Record<string, unknown>)[discriminator] : undefined;
      const typeStyle =
        typeof elementType === 'string'
          ? (typeStyles as Record<string, string>)[String(elementType).toLowerCase()] ||
            TYPE_STYLE_MAP[String(elementType).toLowerCase()]
          : undefined;
      if (typeof f === 'string') {
        return { key: f, style: (typeof styles === 'object' ? (styles as Record<string, string>)[f] : undefined) || typeStyle };
      }
      const key = fieldKey(f);
      return { key, style: f.style || (typeof styles === 'object' ? (styles as Record<string, string>)[key] : undefined) || typeStyle, label: f.label, fallback: f.fallback };
    });
  } else if (target && typeof target === 'object' && !Array.isArray(target)) {
    const elementType = (target as Record<string, unknown>)[discriminator];
    const normalizedElementType = normalizeDiscriminatorValue(elementType);
    const dv = normalizedDisc !== 'none'
      ? (((section as Record<string, unknown>).discriminatorValues as any[]) || []).find((d) => normalizeDiscriminatorValue(d.name) === normalizedElementType)
      : undefined;
    const typeStyle =
      dv && typeof dv.style === 'string' ? dv.style
      : typeof elementType === 'string'
        ? (typeStyles as Record<string, string>)[normalizedElementType.toLowerCase()] ||
          (typeStyles as Record<string, string>)[String(elementType).toLowerCase()] ||
          TYPE_STYLE_MAP[normalizedElementType.toLowerCase()] ||
          TYPE_STYLE_MAP[String(elementType).toLowerCase()]
        : undefined;
    const keys = Object.keys(target as Record<string, unknown>).filter((k) => (section as Record<string, unknown>).showDiscriminator === true || (normalizedDisc === 'none' ? true : k !== discriminator));
    // If requested fields (none case) or per-discriminator fieldsOrdered exist, prefer them.
    let ordered: string[] = keys;
    if (normalizedDisc === 'none') {
      const reqFields = (section as Record<string, unknown>).fields as any[] | undefined;
      if (Array.isArray(reqFields) && reqFields.length) {
        ordered = reqFields.map((f) => f.name).filter((k) => keys.includes(k)).concat(keys.filter((k) => !reqFields.map((f: any) => f.name).includes(k)));
      }
    } else if (dv && Array.isArray(dv.fieldsOrdered) && dv.fieldsOrdered.length) {
      ordered = dv.fieldsOrdered
        .map((f: { name?: string }) => f.name)
        .filter((k: string | undefined): k is string => Boolean(k));
    } else if (Array.isArray(fieldOrder) && (fieldOrder as unknown[]).length > 0) {
      ordered = (fieldOrder as string[]).filter((k) => keys.includes(k)).concat(keys.filter((k) => !(fieldOrder as string[]).includes(k)));
    }
    fieldList = ordered.map((k) => {
      const reqField =
        normalizedDisc === 'none'
          ? ((section as Record<string, unknown>).fields as any[] | undefined)?.find((f) => f.name === k)
          : dv?.fieldsOrdered?.find((f: any) => f.name === k);
      const reqStyle = reqField?.style;
      const style =
        reqStyle ||
        (typeof fieldStyles === 'object' && (fieldStyles as Record<string, unknown>)[k] ? String((fieldStyles as Record<string, unknown>)[k]) : undefined) ||
        (typeof styles === 'object' && (styles as Record<string, unknown>)[k] ? String((styles as Record<string, unknown>)[k]) : undefined) ||
        typeStyle;
      return { key: k, style, fallback: reqField?.fallback };
    });
  } else {
    fieldList = [];
  }

  // Order fields if requested
  if (Array.isArray(order) && order.length > 0) {
    const ordered: typeof fieldList = [];
    const remaining = [...fieldList];
    for (const name of order) {
      const idx = remaining.findIndex((f) => f.key === name);
      if (idx >= 0) ordered.push(remaining.splice(idx, 1)[0]);
    }
    ordered.push(...remaining);
    fieldList = ordered;
  }

  // Build output
  const lines: string[] = [];
  if (template && typeof template === 'string') {
    let rendered = template;
    for (const f of fieldList) {
      if (!f.key) continue;
      const val = getNestedValue(target, f.key, lang);
      const raw = stringifyValue(val);
      const text = applyStyle(raw.trim() ? raw : (f.fallback || ''), f.style);
      rendered = rendered.replace(new RegExp(`\\{${f.key}\\}`, 'g'), text);
    }
    // also allow {value}
    rendered = rendered.replace(/\{value\}/g, stringifyValue(target));
    lines.push(rendered);
  } else if (fieldList.length > 0) {
    for (const f of fieldList) {
      if (!f.key) continue;
      const val = getNestedValue(target, f.key, lang);
      const raw = stringifyValue(val);
      const text = applyStyle(raw.trim() ? raw : (f.fallback || ''), f.style);
      if (text) {
        if (f.label) lines.push(`${f.label}: ${text}`);
        else lines.push(text);
      }
    }
  } else {
    const text = applyStyle(stringifyValue(target), typeof styles === 'string' ? styles : undefined);
    if (text) lines.push(text);
  }

  return stripHtmlTags(normalizeLineSpacing(lines.filter(Boolean).join('\n'), lang));
}

export const extractSectionText = extractApiSectionText;
export const renderApiSection = extractApiSectionText;
export const extractNoteSection = extractApiSectionText;

export interface NotePreviewTab {
  title: string;
  text: string;
}

export interface NotePreviewContent {
  text: string;
  tabs?: NotePreviewTab[];
}

export function formatApiSectionPreview(
  rawSection: Partial<NoteSection>,
  data: unknown,
  lang?: string,
): NotePreviewContent {
  const section = rawSection as Record<string, unknown>;
  const resultSection = section.resultSection as string | undefined;
  const resolved = getNestedValue(data, resultSection, lang);
  const items = Array.isArray(resolved)
    ? resolved
    : Array.isArray(data)
      ? data
      : null;
  const discriminator = section.discriminator as string | undefined;
  const hasDiscriminator = Boolean(discriminator && discriminator !== 'none');

  const candidate = items && items.length > 1 && items.every((m) => m && typeof m === 'object')
    && !(
      hasDiscriminator &&
      items.every((m) => m && typeof m === 'object' && (m as Record<string, unknown>)[discriminator as string] !== undefined)
    )
    ? (() => {
        const first = items[0] as Record<string, unknown>;
        const listProp = Object.keys(first).find((k) => {
          const val = first[k];
          return Array.isArray(val) && val.length > 0 && val.every((x) => x && typeof x === 'object');
        });
        return listProp ? { listProp, items } : null;
      })()
    : null;

  if (candidate) {
    const tabs = candidate.items.map((group, idx) => {
      const m = group as Record<string, unknown>;
      const titleProp =
        (['titre', 'title', 'name', 'label', 'heading'] as string[]).find((k) => typeof m[k] === 'string') ||
        Object.keys(m).find((k) => typeof m[k] === 'string' && !Array.isArray(m[k]));
      const title = String(titleProp ? m[titleProp] : `Tab ${idx + 1}`);
      const lectures = (m[candidate.listProp] as unknown[]) || [];
      const text = lectures
        .map((lec) => extractApiSectionText({ ...rawSection, resultSection: undefined }, lec, lang))
        .filter(Boolean)
        .join('\n\n');
      return { title, text };
    });
    if (tabs.length > 1) {
      return { text: '', tabs };
    }
  }

  return { text: extractApiSectionText(rawSection, data, lang) };
}

// Plural aliases for fetch-like helpers
export function fetchNoteApiContent(section: Partial<NoteSection>, data: unknown, lang?: string): string {
  return extractApiSectionText(section, data, lang);
}

export const assembleNoteSectionText = extractApiSectionText;

// Date style alias
export const formatNoteDate = formatDate;
