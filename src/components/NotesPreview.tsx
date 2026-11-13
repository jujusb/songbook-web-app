"use client";

import React from 'react';
import { NoteMetadata } from '@/lib/notes';
import { useTranslation } from '@/lib/i18n';

interface NotesPreviewProps {
  note: NoteMetadata | null;
  showActions: boolean;
}

export const NotesPreview: React.FC<NotesPreviewProps> = ({
  note,
  showActions = true
}) => {
  const { t } = useTranslation();
  if (!note) {
    return <div>{t('notePreview.noneSelected')}</div>;
  }
  
  return (
    <div>
      <h3>{note?.title || t('notePreview.untitled')}</h3>
      <p>{note?.language || t('notesList.na')}</p>
      {showActions && note.id && (
        <a href={`/notes/${note.id}`} className="button">{t('notePreview.view')}</a>
      )}
    </div>
  );
};

export default NotesPreview;
