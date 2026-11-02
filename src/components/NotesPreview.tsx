import React from 'react';
import { NoteMetadata } from '@/lib/notes';

interface NotesPreviewProps {
  note: NoteMetadata | null;
  showActions: boolean;
}

export const NotesPreview: React.FC<NotesPreviewProps> = ({
  note,
  showActions = true
}) => {
  if (!note) {
    return <div>No note selected</div>;
  }
  
  return (
    <div>
      <h3>{note?.title || 'No Note'}</h3>
      <p>{note?.language || 'N/A'}</p>
      {showActions && note.id && (
        <a href={`/notes/${note.id}`} className="button">View</a>
      )}
    </div>
  );
};

export default NotesPreview;
