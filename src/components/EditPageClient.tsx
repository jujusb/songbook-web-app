'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { EditorView } from '@/components/EditorView';
import { ReferenceEditor } from '@/components/ReferenceEditor';
import type { Reference } from '@/lib/content/schemas';

export function EditPageClient({
  songId,
  lang,
  initialContent,
  references,
  languages,
  title,
  status,
  initialShowReferences = false,
}: {
  songId: string;
  lang: string;
  initialContent: string;
  references: Reference[];
  languages: string[];
  title: string;
  status: string;
  initialShowReferences?: boolean;
}) {
  const { t } = useTranslation();
  const [showReferences, setShowReferences] = useState(initialShowReferences);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-950">
        <div>
          <h1 className="font-semibold">{title}</h1>
          <span className="text-xs text-neutral-500">
            {t('song.editing')}: {lang.toUpperCase()} &middot; {t('song.status')}: {status}
          </span>
        </div>
        <button
          onClick={() => setShowReferences(true)}
          className="text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          {t('song.referencesEditor')}
        </button>
      </div>
      <EditorView
        songId={songId}
        lang={lang}
        initialContent={initialContent}
      />
      {showReferences && (
        <ReferenceEditor
          references={references}
          songId={songId}
          languages={languages}
          onClose={() => setShowReferences(false)}
        />
      )}
    </div>
  );
}
