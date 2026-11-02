/** 
 * Recurrent Notes Management 
 * Manages recurrent notes with API integration and markdown content 
 */
 
// Note structure and types
export type NotePeriodicBehavior = 'same' | 'different_per_period';

export interface NoteSection {
  type: 'manual' | 'api';
  typeStyles?: Record<string, string>;
  md?: string;
  name?: string;
  api_url?: string;
  resultSection?: string;
  authorization?: string;
  languages?: string;
  periodic_behavior?: NotePeriodicBehavior;
}

// Backwards-compatible alias for the previous name.
export type NoteContent = NoteSection;

export interface NoteApiSource {
  name: string;
  api_url: string;
  resultSection?: string;
  authorization?: string;
  languages?: string;
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
  // Alias kept for backwards compatibility.
  content: NoteSection[];
  // Legacy aggregate fields, derived from `sections`.
  api_source: 'manual' | 'api' | 'custom';
  api_sources: NoteApiSource[];
  last_fetched?: string;
  last_edited?: string;
  created: string;
  tags: string[];
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
  if (typeof window !== 'undefined') {
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
  return (sections ?? []).map((s) => ({ ...s }));
}

function normalizeNote(note: Partial<NoteMetadata>): NoteMetadata {
  const sections = normalizeSections(note);
  const apiSources =
    Array.isArray(note.api_sources) && (note.api_sources as unknown[]).length > 0
      ? (note.api_sources as NoteApiSource[])
      : toApiSources(sections);
  const apiSource = deriveApiSource(sections, note.api_source as NoteMetadata['api_source'] | undefined);
  return {
    id: (note.id as string) || `note-${Date.now()}`,
    title: (note.title as string) || '',
    language: (note.language as string) || 'en',
    recurrent_type: (note.recurrent_type as NoteMetadata['recurrent_type']) || 'weekly',
    recurrent_schedule: (note.recurrent_schedule as string) || 'sunday',
    periodic_behavior: (note.periodic_behavior as NoteMetadata['periodic_behavior']) || 'same',
    sections,
    content: sections,
    api_source: apiSource,
    api_sources: apiSources,
    last_fetched: note.last_fetched as string | undefined,
    last_edited: note.last_edited as string | undefined,
    created: (note.created as string) || new Date().toISOString(),
    tags: (note.tags as string[]) || [],
  };
}
// Initialize storage
const storage = getStorageFromLocal();
export const notesStorage = storage;
 
// Notes API module - named export for route imports
export const notesApi = {
  // Fetch notes from API (placeholder for future API integration)
  fetchNotes: async (): Promise<NoteMetadata[]> => {
    const s = getStorageFromLocal();
    return Object.values(s).map((note) => normalizeNote(note)).filter(note =>
      note.recurrent_type ? true : false
    );
  },
 
  // Fetch a single note
  fetchNote: async (noteId: string): Promise<NoteMetadata | null> => {
    const s = getStorageFromLocal();
    return s[noteId] ? normalizeNote(s[noteId]) : null;
  },
 
  // Create a new note
  createNote: async (note: Partial<NoteMetadata>): Promise<NoteMetadata> => {
    const hasSections =
      Array.isArray(note.sections) || Array.isArray(note.content) || Array.isArray(note.api_sources);
    const sections = hasSections ? normalizeSections(note) : [{ type: 'manual' as const, md: '' }];
    const newNote = normalizeNote({
      ...note,
      id: note.id || `note-${Date.now()}`,
      sections,
      content: sections,
      last_fetched: new Date().toISOString(),
      last_edited: new Date().toISOString(),
      created: new Date().toISOString(),
    });

    const s = getStorageFromLocal();
    s[newNote.id] = newNote;
    saveStorageToLocal(s);
    return newNote;
  },
 
  // Update a note
  updateNote: async (noteId: string, updates: Partial<NoteMetadata>): Promise<NoteMetadata> => {
    const s = getStorageFromLocal();

    if (!s[noteId]) {
      throw new Error('Note not found');
    }

    const updatedNote = normalizeNote({
      ...normalizeNote(s[noteId]),
      ...updates,
      id: noteId,
      last_edited: new Date().toISOString(),
    });

    const sUpdated = getStorageFromLocal();
    sUpdated[noteId] = updatedNote;
    saveStorageToLocal(sUpdated);
    return updatedNote;
  },

  // Delete a note
  deleteNote: async (noteId: string): Promise<boolean> => {
    const s = getStorageFromLocal();
 
    if (!s[noteId]) {
      return false;
    }
 
    const { [noteId]: deleted, ...remaining } = s;
    saveStorageToLocal(remaining);
    return true;
  },
 
  // Search notes
  searchNotes: async (query: string, filters?: {
    recurrentType?: string;
    language: string;
  }): Promise<NoteSearchResult[]> => {
    const s = getStorageFromLocal();
    const results: NoteSearchResult[] = [];
 
    for (const [noteId, rawNote] of Object.entries(s)) {
      const note = normalizeNote(rawNote);
      const matchesTitle = note.title.toLowerCase().includes(query.toLowerCase());
      const matchesLanguage = note.language === filters?.language;
      const matchesRecurrentType = filters?.recurrentType 
        ? note.recurrent_type === filters.recurrentType 
        : true;
 
      if (matchesTitle || matchesLanguage || matchesRecurrentType) {
        results.push({
          noteId,
          title: note.title,
          language: note.language,
          recurrentType: note.recurrent_type,
          snippet: note.content.length > 0 ? note.content[0].md || note.title.substring(0, 100) : '',
          highlightTerms: [query],
        });
      }
    }
 
    return results.slice(0, 10);
  },
 
  // Get all notes
  getAllNotes: async (): Promise<NoteMetadata[]> => {
    return Object.values(getStorageFromLocal()).map((note) => normalizeNote(note));
  },
} as const;

// --- External API helpers (date + nested JSON extraction) ---

export type NoteApiContext = {
  lang?: string;
  date?: Date | string;
  dateFormat?: string;
};

export type NoteApiField = string | { key?: string; path?: string; field?: string; label?: string; style?: string };

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
  result = result.replace(/\$\{LANG\}|\$LANG/g, () => lang);

  return result;
}

export const buildNoteApiUrl = interpolateApiUrl;
export const interpolateNoteUrl = interpolateApiUrl;

export function getNestedValue(data: unknown, path?: string): unknown {
  if (!path || path.trim() === '') return data;
  const normalized = path.trim().replace(/\[\]/g, '').replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.').filter(Boolean);
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(part);
      if (!Number.isNaN(index)) current = current[index];
      else current = (current as unknown as Record<string, unknown>)[part];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
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
  if (!style) return text;
  const fn = STYLE_MAP[style.toLowerCase()];
  return fn ? fn(text) : text;
}

function fieldKey(field: NoteApiField): string {
  if (typeof field === 'string') return field;
  return field.key || field.path || field.field || '';
}

export const TYPE_STYLE_MAP: Record<string, string> = {
  titre: 'h2',
  title: 'h2',
  heading: 'h2',
  sous_titre: 'h3',
  subtitle: 'h3',
};

export function extractApiSectionText(section: Partial<NoteSection>, data: unknown): string {
  const resultSection =
    (section as Record<string, unknown>).resultSection || (section as Record<string, unknown>).resultPath || (section as Record<string, unknown>).result_path;
  const source = getNestedValue(data, resultSection as string | undefined);

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

  const template = (section as Record<string, unknown>).displayTemplate || (section as Record<string, unknown>).template || (section as Record<string, unknown>).display;

  // If a display template is provided, render placeholders.
  const target = source === undefined ? data : source;

  // Arrays (e.g. messes.lectures or messes.lectures[]): render each element,
  // using its `type` field to decide how the content is displayed.
  if (Array.isArray(target)) {
    const { resultSection: _a, resultPath: _b, result_path: _c, ...rest } = section as Record<string, unknown>;
    return target
      .map((item) => extractApiSectionText(rest as Partial<NoteSection>, item))
      .filter(Boolean)
      .join('\n');
  }

  // Determine field list
  let fieldList: Array<{ key: string; style?: string; label?: string }>;
  if (Array.isArray(fields) && fields.length > 0) {
    fieldList = (fields as NoteApiField[]).map((f) => {
      const elementType = target && typeof target === 'object' && !Array.isArray(target) ? (target as Record<string, unknown>).type : undefined;
      const typeStyle =
        typeof elementType === 'string'
          ? (typeStyles as Record<string, string>)[String(elementType).toLowerCase()] ||
            TYPE_STYLE_MAP[String(elementType).toLowerCase()]
          : undefined;
      if (typeof f === 'string') {
        return { key: f, style: (typeof styles === 'object' ? (styles as Record<string, string>)[f] : undefined) || typeStyle };
      }
      const key = fieldKey(f);
      return { key, style: f.style || (typeof styles === 'object' ? (styles as Record<string, string>)[key] : undefined) || typeStyle, label: f.label };
    });
  } else if (target && typeof target === 'object' && !Array.isArray(target)) {
    const elementType = (target as Record<string, unknown>).type;
    const typeStyle =
      typeof elementType === 'string'
        ? (typeStyles as Record<string, string>)[elementType.toLowerCase()] || TYPE_STYLE_MAP[elementType.toLowerCase()]
        : undefined;
    fieldList = Object.keys(target as Record<string, unknown>)
      .filter((k) => k !== 'type')
      .map((k) => ({
        key: k,
        style:
          typeof styles === 'object' && (styles as Record<string, unknown>)[k]
            ? String((styles as Record<string, unknown>)[k])
            : typeStyle,
      }));
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
      const val = getNestedValue(target, f.key);
      const text = applyStyle(stringifyValue(val), f.style);
      rendered = rendered.replace(new RegExp(`\\{${f.key}\\}`, 'g'), text);
    }
    // also allow {value}
    rendered = rendered.replace(/\{value\}/g, stringifyValue(target));
    lines.push(rendered);
  } else if (fieldList.length > 0) {
    for (const f of fieldList) {
      if (!f.key) continue;
      const val = getNestedValue(target, f.key);
      const text = applyStyle(stringifyValue(val), f.style);
      if (text) {
        if (f.label) lines.push(`${f.label}: ${text}`);
        else lines.push(text);
      }
    }
  } else {
    const text = applyStyle(stringifyValue(target), typeof styles === 'string' ? styles : undefined);
    if (text) lines.push(text);
  }

  return lines.filter(Boolean).join('\n');
}

export const extractSectionText = extractApiSectionText;
export const renderApiSection = extractApiSectionText;
export const extractNoteSection = extractApiSectionText;

// Plural aliases for fetch-like helpers
export function fetchNoteApiContent(section: Partial<NoteSection>, data: unknown): string {
  return extractApiSectionText(section, data);
}

export const assembleNoteSectionText = extractApiSectionText;

// Date style alias
export const formatNoteDate = formatDate;
