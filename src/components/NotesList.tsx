"use client";

import React, { useState, useEffect } from 'react';
import { notesApi } from '@/lib/notes';

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
  content: Array<{ type: string; md?: string }>;
}

export const NotesList: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

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
        <h1 className="text-3xl font-bold">Recurrent Notes</h1>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 transition-colors"
          onClick={() => window.location.href = `/notes/new`}
        >
          New Note
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-500 text-center">No notes found</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer transition-colors"
              onClick={() => window.location.href = `/notes/${note.id}/edit`}
            >
              <div className="font-medium">{note.title}</div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {note.language || 'N/A'} • {note.recurrent_type || 'manual'} • {note.periodic_behavior}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default NotesList;
