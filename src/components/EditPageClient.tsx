'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { setSongTitleAction, setSongKeyAction, addSongTranslationAction, removeSongTranslationAction, toggleSongPublishedAction } from '@/app/actions';
import { EditorView } from '@/components/EditorView';
import { ReferenceEditor } from '@/components/ReferenceEditor';
import { MusicLinksEditor } from '@/components/MusicLinksEditor';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { RevisionSidebar } from '@/components/RevisionSidebar';
import type { Reference, SpotifyLinks } from '@/lib/content/schemas';

/**
 * Suggestions for the tonality field, matching the `key` value format the
 * importers produce (`[A-G][b#]?m?`). The field stays free text, since a song
 * can be written in any spelling the player uses.
 */
const TONALITY_OPTIONS = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
  'Am', 'Bbm', 'Bm', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m',
] as const;

export function EditPageClient({
  songId,
  lang,
  initialContent,
  references,
  spotify,
  youtube,
  languages,
  translations,
  translationsContent,
  title,
  status,
  published,
  keySignature,
  initialShowReferences = false,
}: {
  songId: string;
  lang: string;
  initialContent: string;
  references: Reference[];
  spotify?: SpotifyLinks;
  youtube?: string;
  languages: string[];
  translations: string[];
  translationsContent: Record<string, string>;
  title: string;
  status: string;
  keySignature: string | undefined;
  published?: boolean;
  initialShowReferences?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showReferences, setShowReferences] = useState(initialShowReferences);
  const [showMusicLinks, setShowMusicLinks] = useState(false);
  const [showRevisionsSidebar, setShowRevisionsSidebar] = useState(true);
  const [titleInput, setTitleInput] = useState(title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleSaved, setTitleSaved] = useState(true);
  const [keyInput, setKeyInput] = useState(keySignature ?? '');
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(true);
  const [translationBusy, setTranslationBusy] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationLangs, setTranslationLangs] = useState<string[]>(translations);
  const [isPublished, setIsPublished] = useState(published ?? false);
  const [savingPublished, setSavingPublished] = useState(false);

  useEffect(() => {
    setTranslationLangs(translations);
  }, [translations]);

  useEffect(() => {
    setTitleInput(title);
    setTitleSaved(true);
  }, [title]);

  useEffect(() => {
    setKeyInput(keySignature ?? '');
    setKeySaved(true);
  }, [keySignature]);

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

  const handleSaveKey = async () => {
    const next = keyInput.trim();
    if (next === (keySignature ?? '').trim()) return;
    setSavingKey(true);
    try {
      await setSongKeyAction(songId, next);
      setKeySaved(true);
      router.refresh();
    } catch (err) {
      console.error('Key save failed:', err);
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveTranslation = async (langToRemove: string) => {
    setTranslationBusy(langToRemove);
    setTranslationError(null);
    const res = await removeSongTranslationAction(songId, langToRemove, lang);
    if (res.ok) {
      setTranslationBusy(null);
      setTranslationLangs(res.remaining);
      if (res.nextLang === lang) {
        router.refresh();
      } else {
        router.push(`/edit/${songId}/${res.nextLang}`);
        router.refresh();
      }
    } else {
      setTranslationBusy(null);
      setTranslationError(
        res.error === 'LAST_TRANSLATION' ? t('song.keepOneTranslation') : t('errors.generic')
      );
    }
  };

  const handleAddTranslation = async (langToAdd: string) => {
    setTranslationBusy(langToAdd);
    setTranslationError(null);
    const res = await addSongTranslationAction(songId, langToAdd);
    if (res.ok) {
      router.push(`/edit/${songId}/${langToAdd}`);
      router.refresh();
    } else {
      setTranslationBusy(null);
      setTranslationError(res.error === 'TRANSLATION_EXISTS' ? t('song.translationExists') : t('errors.generic'));
    }
  };

  const handleTogglePublished = async () => {
    setSavingPublished(true);
    try {
      const res = await toggleSongPublishedAction(songId, lang);
      if (res.ok) {
        setIsPublished(res.published);
      } else {
        // Could show error
        console.error('Failed to toggle published:', res.error);
      }
    } catch (err) {
      console.error('Published toggle failed:', err);
    } finally {
      setSavingPublished(false);
    }
  };

  const availableToAdd = languages.filter((l) => !translationLangs.includes(l));

return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Left Sidebar - Revisions */}
      {showRevisionsSidebar && (
        <div className="w-72 flex-shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-y-auto hidden lg:block">
          <RevisionSidebar songId={songId} lang={lang} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
            <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-800 shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <label
                htmlFor="song-key-signature"
                className="text-xs text-neutral-500 whitespace-nowrap"
              >
                {t('song.tonality')}
              </label>
              <input
                id="song-key-signature"
                type="text"
                list="song-key-signature-options"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setKeySaved(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveKey();
                  }
                }}
                placeholder={t('song.tonalityPlaceholder')}
                className="w-16 px-2 py-1 border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-500 rounded-md bg-transparent focus:bg-white dark:focus:bg-neutral-900 outline-none"
                aria-label={t('song.tonality')}
              />
              <datalist id="song-key-signature-options">
                {TONALITY_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <button
                onClick={handleSaveKey}
                disabled={savingKey || keySaved}
                className="text-xs px-2.5 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {savingKey ? t('common.saving') : keySaved ? t('common.saved') : t('common.save')}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-neutral-500">
              {t('song.status')}: {status}
            </span>
            {isPublished !== undefined && (
              <button
                onClick={handleTogglePublished}
                disabled={savingPublished}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  published
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700'
                    : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
                } hover:opacity-90 disabled:opacity-50`}
              >
                {savingPublished ? t('common.saving') : isPublished ? t('song.published') : t('song.unpublished')}
              </button>
            )}
            <button
              onClick={() => setShowMusicLinks(true)}
              className="text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('song.musicLinks')}
            </button>
            <button
              onClick={() => setShowReferences(true)}
              className="text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('song.referencesEditor')}
            </button>
            <button
              onClick={() => setShowRevisionsSidebar(!showRevisionsSidebar)}
              className="text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {showRevisionsSidebar ? t('revisions.hide') : t('revisions.view')}
            </button>
          </div>
        </div>
        <LanguageSwitcher
          songId={songId}
          languages={translationLangs}
          currentLang={lang}
          linkFor={(l) => `/edit/${songId}/${l}`}
          onRemove={translationLangs.length > 1 ? handleRemoveTranslation : undefined}
          onAdd={handleAddTranslation}
          availableToAdd={availableToAdd}
          busy={translationBusy}
        />
        {translationError && (
          <div className="px-4 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900">
            {translationError}
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <EditorView
            songId={songId}
            lang={lang}
            initialContent={initialContent}
            translations={translationLangs}
            translationsContent={translationsContent}
          />
        </div>
        {showReferences && (
          <ReferenceEditor
            references={references}
            songId={songId}
            languages={translations}
            content={initialContent}
            lang={lang}
            onClose={() => setShowReferences(false)}
          />
        )}
        {showMusicLinks && (
          <MusicLinksEditor
            songId={songId}
            initialSpotifySong={spotify?.song}
            initialYoutube={youtube}
            onClose={() => setShowMusicLinks(false)}
          />
        )}
      </div>
    </div>
  );
}
