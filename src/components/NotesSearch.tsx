import React, { useState } from 'react';
import { notesApi, NoteSearchResult } from '@/lib/notes';
import { useTranslation } from '@/lib/i18n';

interface NotesSearchProps {
  onSelect: (note: unknown) => void;
  defaultQuery?: string;
}

export const NotesSearch: React.FC<NotesSearchProps> = ({
  onSelect,
  defaultQuery = ''
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<NoteSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recurrentType, setRecurrentType] = useState<string | undefined>(undefined);
  const [language, setLanguage] = useState<string>('en-US');
  
  const handleSearch = async () => {
    const filters: { recurrentType?: string; language: string } = {
      language: language
    };
    if (recurrentType) filters.recurrentType = recurrentType;
    
    setQuery('');
    setLoading(true);
    
    try {
      const results = await notesApi.searchNotes(query, filters);
      setResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-4 space-y-2">
      <div className="flex flex-row">
        <input
          className="flex-1 p-2 border rounded focus-ring-2 focus-blue-500"
          placeholder={t('notes.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="bg-blue-500 text-white p-2 rounded"
          onClick={() => setQuery('')}
        >
          Clear
        </button>
      </div>
      
      <div className="space-y-2">
        <select
          className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
          value={recurrentType || ''}
          onChange={(e) => setRecurrentType(e.target.value || undefined)}
        >
          <option value="">{t('notes.anyType')}</option>
          <option value="weekly">{t('notes.typeWeekly')}</option>
          <option value="monthly">{t('notes.typeMonthly')}</option>
          <option value="specific-dates">{t('notes.typeSpecificDates')}</option>
          <option value="daily">{t('notes.typeDaily')}</option>
        </select>
        
        <select
          className="w-full p-2 border rounded focus:ring-2 focus-blue-500"
          value={language}
          onChange={(e) => setLanguage(e.target.value || 'en-US')}
        >
          <option value="en-US">{t('notes.langEnglish')}</option>
          <option value="es-ES">{t('notes.langSpanish')}</option>
          <option value="fr-FR">{t('notes.langFrench')}</option>
          <option value="de">{t('notes.langGerman')}</option>
        </select>
        
        <button className="bg-blue-500 text-white p-2 rounded" onClick={handleSearch}>
          Search
        </button>
      </div>
      
      <div className="space-y-2">
        {results.length > 0 ? (
          results.map((result: NoteSearchResult) => (
            <div
              key={result.noteId}
              className="p-2 border rounded hover:bg-blue-100 cursor-pointer"
              onClick={() => onSelect(result)}>
              <div className="font-medium">{result.title}</div>
              <p className="text-sm text-gray-500">
                {result.recurrentType} • {result.language}
              </p>
            </div>
          ))
        ) : <p className="text-sm text-gray-500">{t('notes.noSearchResults')}</p>
        }
      </div>
    </div>
  );
};

export default NotesSearch;
