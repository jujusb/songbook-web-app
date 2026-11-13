"use client";

import React, { useState, useEffect } from 'react';
import { notesApi, normalizeNote, NoteMetadata } from '@/lib/notes';
import { useTranslation } from '@/lib/i18n';

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
  const { t } = useTranslation();
  const [note, setNote] = useState<NoteMetadata>({
    id: noteId || `note-${Date.now()}`,
    title: '',
    language: 'en-US',
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
        <h2 className="text-2xl font-bold mb-6">{noteId ? t('noteForm.editNote') : t('notes.newNote')}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('notesEditor.title')}</label>
            <input
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              value={note.title}
              onChange={(e) => setNote({ ...note, title: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.language')}</label>
              <select
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                value={note.language}
                onChange={(e) => setNote({ ...note, language: e.target.value as 'en-US' | 'es-ES' | 'fr-FR' | 'de' })}
              >
                <option value="en-US">{t('notes.langEnglish')}</option>
                <option value="es-ES">{t('notes.langSpanish')}</option>
                <option value="fr-FR">{t('notes.langFrench')}</option>
                <option value="de">{t('notes.langGerman')}</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('noteForm.recurrentType')}</label>
              <select
                className="w-full p-2 border rounded focus:ring-2 focus-ring-blue-500"
                value={note.recurrent_type}
                onChange={(e) => setNote({ ...note, recurrent_type: e.target.value as 'weekly' | 'monthly' | 'specific-dates' | 'daily' })}
              >
                <option value="weekly">{t('notes.typeWeekly')}</option>
                <option value="monthly">{t('notes.typeMonthly')}</option>
                <option value="specific-dates">{t('notes.typeSpecificDates')}</option>
                <option value="daily">{t('notes.typeDaily')}</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('noteForm.recurrentSchedule')}</label>
              <select
                className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
                value={note.recurrent_schedule}
                onChange={(e) => setNote({ ...note, recurrent_schedule: e.target.value })}
              >
                <option value="sunday">{t('noteForm.daySunday')}</option>
                <option value="monday">{t('noteForm.dayMonday')}</option>
                <option value="tuesday">{t('noteForm.dayTuesday')}</option>
                <option value="wednesday">{t('noteForm.dayWednesday')}</option>
                <option value="thursday">{t('noteForm.dayThursday')}</option>
                <option value="friday">{t('noteForm.dayFriday')}</option>
                <option value="saturday">{t('noteForm.daySaturday')}</option>
                <option value="first">{t('noteForm.schedFirst')}</option>
                <option value="first-second">{t('noteForm.schedFirstSecond')}</option>
                <option value="last">{t('noteForm.schedLast')}</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('noteForm.tagsLabel')}</label>
            <input
              className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
              value={note.tags.join(', ')}
              onChange={(e) => setNote({ ...note, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('notesEditor.apiSource')}</label>
            <select
              className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
              value={note.api_source}
              onChange={(e) => setNote({ ...note, api_source: e.target.value as 'manual' | 'api' | 'custom' })}
            >
              <option value="manual">{t('notesEditor.sourceManual')}</option>
              <option value="api">{t('notesEditor.sourceApi')}</option>
              <option value="custom">{t('notesEditor.sourceCustom')}</option>
            </select>
          </div>
        </div>
        
        {note.api_source === 'api' && (
          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('noteForm.apiEndpoint')}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('noteForm.resultSection')}</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('notesEditor.tags')}</label>
          <input
            className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
            value={note.tags.join(', ')}
            onChange={(e) => setNote({ ...note, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
          />
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('notesEditor.contentMarkdown')}</label>
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
          {t('noteForm.saveNote')}
        </button>
        <button
          className="bg-gray-200 ml-2 px-4 rounded"
          onClick={() => onSave(note)}
        >
          {t('common.cancel')}
        </button>
      </div>
    </>
  );
};

export default NotesEditor;
