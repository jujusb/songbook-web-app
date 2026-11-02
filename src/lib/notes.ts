/** 
 * Recurrent Notes Management 
 * Manages recurrent notes with API integration and markdown content 
 */
 
// Note structure and types
export interface NoteMetadata {
  id: string;
  title: string;
  language: string;
  recurrent_type: 'weekly' | 'monthly' | 'specific-dates' | 'daily';
  recurrent_schedule: string;
  periodic_behavior: 'same' | 'different_per_period';
  api_source: 'manual' | 'api' | 'custom';
  api_sources: Array<{
    name: string;
    api_url: string;
    resultSection?: string;
    authorization?: string;
    languages?: string;
  }>;
  last_fetched?: string;
  last_edited?: string;
  created: string;
  tags: string[];
  content: NoteContent[];
}
 
export interface NoteContent {
  type: 'manual' | 'api';
  md?: string;
  name?: string;
  api_url?: string;
  resultSection?: string;
  authorization?: string;
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
  if (typeof window !== 'undefined') {
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
 
// Initialize storage
const storage = getStorageFromLocal();
export const notesStorage = storage;
 
// Notes API module - named export for route imports
export const notesApi = {
  // Fetch notes from API (placeholder for future API integration)
  fetchNotes: async (): Promise<NoteMetadata[]> => {
    const s = getStorageFromLocal();
    return Object.values(s).filter(note => 
      note.recurrent_type ? true : false
    );
  },
 
  // Fetch a single note
  fetchNote: async (noteId: string): Promise<NoteMetadata | null> => {
    const s = getStorageFromLocal();
    return s[noteId] || null;
  },
 
  // Create a new note
  createNote: async (note: NoteMetadata): Promise<NoteMetadata> => {
    const newNote = {
      id: note.id || `note-${Date.now()}`,
      title: note.title,
      language: note.language || 'en',
      recurrent_type: note.recurrent_type || 'weekly',
      periodic_behavior: note.periodic_behavior || 'same',
      recurrent_schedule: note.recurrent_schedule || 'sunday',
      api_source: note.api_source || 'manual',
      api_sources: note.api_sources || [],
      last_fetched: new Date().toISOString(),
      last_edited: new Date().toISOString(),
      created: new Date().toISOString(),
      tags: note.tags || [],
      content: note.content || [{ type: 'manual', md: '' }],
    };
 
    const s = getStorageFromLocal();
    s[note.id || newNote.id] = newNote;
    saveStorageToLocal(s);
    return newNote;
  },
 
  // Update a note
  updateNote: async (noteId: string, updates: Partial<NoteMetadata>): Promise<NoteMetadata> => {
    const s = getStorageFromLocal();
 
    if (!s[noteId]) {
      throw new Error('Note not found');
    }
 
    const updatedNote = {
      ...s[noteId],
      ...updates,
      last_edited: new Date().toISOString(),
    };
 
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
 
    for (const [noteId, note] of Object.entries(s)) {
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
    return Object.values(getStorageFromLocal());
  },
} as const;
