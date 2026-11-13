"use client";

import React, { useState, useEffect } from 'react';
import { notesApi } from '@/lib/notes';
import { useTranslation } from "@/lib/i18n";

interface Note {
  id: string;
  title: string;
  language: string;
  recurrent_type: string;
  recurrent_schedule: string;
  periodic_behavior: string;
  api_source: string;
  api_sources: Array<{ name: string; api_url: string; resultSection?: string; authorization?: string }>;
  last_fetched?: string;
  last_edited?: string;
  created: string;
  tags: string[];
  content?: Array<{ type: string; md?: string }>;
}

export const NotesList: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('notes.confirmDelete'))) return;
    await notesApi.deleteNote(id);
    const notes = await notesApi.getAllNotes();
    setNotes(notes);
  };

  useEffect(() => {
    const loadNotes = async () => {
      setLoading(true);
      const notes = await notesApi.getAllNotes();
      setNotes(notes);
      setLoading(false);
    };
    loadNotes();
  }, []);

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('notes.title')}</h1>
        {!readOnly && (
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 transition-colors"
            onClick={() => window.location.href = `/notes/new`}
          >
            {t('notes.newNote')}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">{t('notes.loadingNotes')}</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-500 text-center">{t('notes.noNotes')}</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer transition-colors"
              onClick={() => window.location.href = `/notes/${note.id}`}
            >
              <div className="font-medium">{note.title}</div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {note.language || 'N/A'} • {note.recurrent_type || 'manual'} • {note.periodic_behavior}
              </p>
              {!readOnly && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); window.location.href = `/notes/${note.id}/edit`; }}
                    className="text-xs px-2 py-1 border rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(note.id, e)}
                    className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default NotesList;
