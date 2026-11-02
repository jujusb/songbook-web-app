import React, { useState } from 'react';
import { notesApi } from '@/lib/notes';

interface SetlistNoteAdderProps {
  setlistId: string;
  onNoteSelected: (note: unknown, date: string) => void;
}

export const SetlistNoteAdder: React.FC<SetlistNoteAdderProps> = ({
  setlistId,
  onNoteSelected
}) => {
  const [noteId, setNoteId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showNoteSelector, setShowNoteSelector] = useState(false);
  
  const handleNoteSelect = async (note: unknown) => {
    setNoteId((note as { id?: string }).id || '');
    setSelectedDate(new Date());
    onNoteSelected(note, selectedDate.toISOString());
    setShowNoteSelector(false);
  };
  
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-2">Add Note to Setlist</h3>
      
      <div className="flex flex-col">
        <div className="flex">
          <select
            className="flex-1 p-2 border rounded focus-ring-2 focus-blue-500"
            onChange={(e) => setNoteId(e.target.value)}
          >
            <option value="">Select a note...</option>
          </select>
          <button
            className="bg-blue-500 text-white p-2 rounded"
            onClick={() => setNoteId('')}
          >
            Cancel
          </button>
        </div>
        
        {showNoteSelector && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">
              Select a note to add it to the setlist
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Date: {new Date().toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetlistNoteAdder;
