'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { setSongTitleAction } from '@/app/actions';
import { EditorView } from '@/components/EditorView';
import { ReferenceEditor } from '@/components/ReferenceEditor';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { Reference } from '@/lib/content/schemas';

export function EditPageClient({
  songId,
  lang,
  initialContent,
  references,
  languages,
  translations,
  title,
  status,
  initialShowReferences = false,
}: {
  songId: string;
  lang: string;
  initialContent: string;
  references: Reference[];
  languages: string[];
  translations: string[];
  title: string;
  status: string;
  initialShowReferences?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showReferences, setShowReferences] = useState(initialShowReferences);
  const [titleInput, setTitleInput] = useState(title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleSaved, setTitleSaved] = useState(true);

  useEffect(() => {
    setTitleInput(title);
    setTitleSaved(true);
  }, [title]);

  const handleSaveTitle = async () => {
    const next = titleInput.trim();
    if (next === title.trim()) return;
    setSavingTitle(true);
    try {
      await setSongTitleAction(songId, lang, next);
      setTitleSaved(true);
      router.refresh();
    } catch (err) {
      console.error('Title save failed:', err);
    } finally {
      setSavingTitle(false);
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto flex items-center justify-between gap-3 bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/songs/${songId}?lang=${lang}`}
            className="text-sm px-2.5 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
          >
            &larr; {t('song.view')}
          </Link>
          <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <input
            type="text"
            value={titleInput}
            onChange={(e) => {
              setTitleInput(e.target.value);
              setTitleSaved(false);
            }}
            className="font-semibold px-2 py-1 border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-500 rounded-md bg-transparent focus:bg-white dark:focus:bg-neutral-900 outline-none max-w-md truncate focus:truncate-none"
            aria-label={t('song.title')}
          />
          <button
            onClick={handleSaveTitle}
            disabled={savingTitle || titleSaved}
            className="text-xs px-2.5 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors shrink-0"
          >
            {savingTitle ? t('common.saving') : titleSaved ? t('common.saved') : t('common.save')}
          </button>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-neutral-500">
            {t('song.status')}: {status}
          </span>
          <button
            onClick={() => setShowReferences(true)}
            className="text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {t('song.referencesEditor')}
          </button>
        </div>
      </div>
      <LanguageSwitcher
        songId={songId}
        languages={translations}
        currentLang={lang}
        linkFor={(l) => `/edit/${songId}/${l}`}
      />
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
          content={initialContent}
          lang={lang}
          onClose={() => setShowReferences(false)}
        />
      )}
    </div>
  );
}
