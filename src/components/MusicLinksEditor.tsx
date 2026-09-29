'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { saveSongLinksAction } from '@/app/actions';
import { youtubeIdFromUrl } from '@/lib/youtube';

function spotifyIdFromUrl(url: string): string | null {
  return url.trim().match(/\/track\/([A-Za-z0-9]+)/)?.[1] ?? null;
}

export function MusicLinksEditor({
  songId,
  initialSpotifySong,
  initialYoutube,
  onClose,
}: {
  songId: string;
  initialSpotifySong?: string;
  initialYoutube?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [spotifySong, setSpotifySong] = useState(initialSpotifySong ?? '');
  const [youtube, setYoutube] = useState(initialYoutube ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    spotifySong.trim() !== (initialSpotifySong ?? '') ||
    youtube.trim() !== (initialYoutube ?? '');

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveSongLinksAction(songId, {
        spotifySong: spotifySong.trim() || undefined,
        youtube: youtube.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FAILED');
    } finally {
      setSaving(false);
    }
  };

  const youtubeId = youtubeIdFromUrl(youtube);
  const spotifyId = spotifyIdFromUrl(spotifySong);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 bg-black/50">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-800 w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 gap-3">
          <h2 className="font-semibold text-lg">{t('song.musicLinks')}</h2>
          <div className="flex items-center gap-2">
            {dirty && !saved && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            )}
            {saved && (
              <span className="text-xs px-3 py-1.5 bg-green-600 text-white rounded">
                {t('common.saved')}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs text-neutral-500 mb-1">
              {t('song.musicSpotifySong')}
            </label>
            <input
              type="url"
              value={spotifySong}
              onChange={(e) => setSpotifySong(e.target.value)}
              placeholder="https://open.spotify.com/track/..."
              className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1.5 bg-transparent"
            />
            {spotifyId ? (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                {t('song.musicSpotifyValid')}
              </p>
            ) : spotifySong.trim() ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {t('song.musicSpotifyInvalid')}
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">
              {t('song.musicYoutube')}
            </label>
            <input
              type="url"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1.5 bg-transparent"
            />
            {youtubeId ? (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                {t('song.musicYoutubeValid')}
              </p>
            ) : youtube.trim() ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {t('song.musicYoutubeInvalid')}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}