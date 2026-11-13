import React, { useState } from 'react';
import { notesApi } from '@/lib/notes';
import { useTranslation } from '@/lib/i18n';

interface SetlistNoteAdderProps {
  setlistId: string;
  onNoteSelected: (note: unknown, date: string) => void;
}

export const SetlistNoteAdder: React.FC<SetlistNoteAdderProps> = ({
  setlistId,
  onNoteSelected
}) => {
  const { t } = useTranslation();
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
      <h3 className="text-sm font-medium mb-2">{t('setlistNote.heading')}</h3>
      
      <div className="flex flex-col">
        <div className="flex">
          <select
            className="flex-1 p-2 border rounded focus-ring-2 focus-blue-500"
            onChange={(e) => setNoteId(e.target.value)}
          >
            <option value="">{t('setlistNote.selectNote')}</option>
          </select>
          <button
            className="bg-blue-500 text-white p-2 rounded"
            onClick={() => setNoteId('')}
          >
            {t('common.cancel')}
          </button>
        </div>
        
        {showNoteSelector && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">
              {t('setlistNote.selectHint')}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {t('setlistNote.date', { date: new Date().toLocaleDateString() })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetlistNoteAdder;
