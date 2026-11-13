"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { changeSongAlbumAction } from "@/app/actions";
import { useTranslation } from "@/lib/i18n";

export const NO_ALBUM = "no-album";

export function ChangeAlbumButton({
  songId,
  currentAlbumIds,
  albums,
}: {
  songId: string;
  currentAlbumIds: string[];
  albums: { id: string; title: string; artist: string }[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const currentId = currentAlbumIds[0] ?? NO_ALBUM;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!value) {
      setError(t('changeAlbum.pickAlbum'));
      return;
    }
    if (value === currentId) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await changeSongAlbumAction(songId, value);
      if (!result.ok) {
        setError(result.error === "READ_ONLY" ? t('changeAlbum.readOnly') : result.error);
        setBusy(false);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError(t('changeAlbum.failed'));
      setBusy(false);
    }
  }, [value, currentId, songId, router, t]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(currentId);
          setEditing(true);
          setError(null);
        }}
        className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        title={t('changeAlbum.title')}
      >
        {t('changeAlbum.button')}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        autoFocus
        className="max-w-52 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <option value={NO_ALBUM}>{t('bulkImport.noAlbum')}</option>
        {albums.map((a) => (
          <option key={a.id} value={a.id}>
            {a.title} ({a.artist})
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? t('common.saving') : t('common.save')}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={busy}
        className="text-sm px-3 py-1 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        {t('common.cancel')}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}