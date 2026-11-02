"use client";

import React, { useState, useEffect } from 'react';
import { notesApi, normalizeNote, NoteMetadata } from '@/lib/notes';

interface NotesEditorProps {
  noteId?: string;
  onSave: (note: NoteMetadata) => void;
  isEdit: boolean;
}

export const NotesEditor: React.FC<NotesEditorProps> = ({
  noteId,
  onSave,
  isEdit = true
}) => {
  const [note, setNote] = useState<NoteMetadata>({
    id: noteId || `note-${Date.now()}`,
    title: '',
    language: 'en',
    recurrent_type: 'weekly',
    recurrent_schedule: 'sunday',
    periodic_behavior: 'same',
    api_source: 'manual',
    api_sources: [],
    last_fetched: '',
    last_edited: new Date().toISOString(),
    tags: [],
    sections: [{ type: 'manual', md: '' }],
    content: [{ type: 'manual', md: '' }],
    created: new Date().toISOString(),
  });

  // Load the stored note when noteId is provided
  useEffect(() => {
    if (!noteId) return;
    let cancelled = false;
    notesApi.fetchNote(noteId).then((n) => {
      if (cancelled || !n) return;
      setNote(normalizeNote(n));
    });
    return () => { cancelled = true; };
  }, [noteId]);

  const handleSave = () => {
    onSave(note);
  };

  return (
    <>
      <div className="p-6 max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">{noteId ? 'Edit Note' : 'New Note'}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              value={note.title}
              onChange={(e) => setNote({ ...note, title: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
              <select
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                value={note.language}
                onChange={(e) => setNote({ ...note, language: e.target.value as 'en' | 'es' | 'fr' | 'de' })}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recurrent Type</label>
              <select
                className="w-full p-2 border rounded focus:ring-2 focus-ring-blue-500"
                value={note.recurrent_type}
                onChange={(e) => setNote({ ...note, recurrent_type: e.target.value as 'weekly' | 'monthly' | 'specific-dates' | 'daily' })}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="specific-dates">Specific Dates</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recurrent Schedule</label>
              <select
                className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
                value={note.recurrent_schedule}
                onChange={(e) => setNote({ ...note, recurrent_schedule: e.target.value })}
              >
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="first">First Sunday of Month</option>
                <option value="first-second">First & Second Sunday</option>
                <option value="last">Last of Month</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
            <input
              className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
              value={note.tags.join(', ')}
              onChange={(e) => setNote({ ...note, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Source</label>
            <select
              className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
              value={note.api_source}
              onChange={(e) => setNote({ ...note, api_source: e.target.value as 'manual' | 'api' | 'custom' })}
            >
              <option value="manual">Manual</option>
              <option value="api">API</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
        
        {note.api_source === 'api' && (
          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">API Endpoint</label>
            <input
              className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
              value={note.api_sources?.[0]?.api_url || ''}
              onChange={(e) => {
                setNote({
                  ...note,
                  api_sources: note.api_sources.map(s => 
                    s.name 
                      ? { ...s, api_url: e.target.value }
                      : { name: 'custom-api', api_url: e.target.value, resultSection: '' }
                  )
                });
              }}
            />
            
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Result Section</label>
              <input
                className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
                value={note.api_sources?.[0]?.resultSection || ''}
                onChange={(e) => setNote({
                  ...note,
                  api_sources: note.api_sources.map(s => 
                    s.name 
                      ? { ...s, resultSection: e.target.value }
                      : { name: 'custom-api', api_url: note.api_sources?.[0]?.api_url || '', resultSection: e.target.value }
                  )
                })}
              />
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          <input
            className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
            value={note.tags.join(', ')}
            onChange={(e) => setNote({ ...note, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
          />
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Content (Markdown)</label>
          <textarea
            className="w-full p-2 border rounded focus:ring-2 focus-blue-500 resize-h"
            rows={10}
            value={(note.content ?? []).length > 0 ? note.content?.[0]?.md || '' : ''}
            onChange={(e) => setNote({
              ...note,
              content: (note.content ?? []).map(c => c.type === 'manual' ? { type: 'manual', md: e.target.value } : c)
            })}
            disabled={note.api_source === 'api'}
            
          >
            {(note.content ?? []).length > 0 ? note.content?.[0]?.md || '' : ''}
          </textarea>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          className="bg-blue-500 text-white px-4 rounded"
          onClick={handleSave}
        >
          Save Note
        </button>
        <button
          className="bg-gray-200 ml-2 px-4 rounded"
          onClick={() => onSave(note)}
        >
          Cancel
        </button>
      </div>
    </>
  );
};

export default NotesEditor;
