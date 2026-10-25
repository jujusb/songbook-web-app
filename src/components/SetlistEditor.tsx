"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { getSetlistMaxSongs } from "@/lib/config";
import { validateLinkUrl } from "@/lib/setlist-links";
import {
  isHttpUrl,
  isSongItem,
  isNoteItem,
  isLinkItem,
  SETLIST_NOTE_MAX_LENGTH,
  SETLIST_LINK_MAX_LENGTH,
  SETLIST_LINK_TITLE_MAX_LENGTH,
  type SetlistItem,
} from "@/lib/content/schemas";

const MAX_SONGS = getSetlistMaxSongs();

interface AvailableSong {
  id: string;
  title: string;
  key?: string;
  translations: string[];
}

function newItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface SetlistData {
  id?: string;
  title: string;
  description: string;
  date: string;
  songs: SetlistItem[];
}

export function SetlistEditor({
  availableSongs,
  initialSetlist,
  isNew,
  allowedLinkHosts = [],
  allowHttpLinks = false,
}: {
  allowedLinkHosts?: string[];
  allowHttpLinks?: boolean;
  availableSongs: AvailableSong[];
  initialSetlist?: SetlistData;
  isNew: boolean;
}) {
  const router = useRouter();
  const { languageLabel, t } = useTranslation();
  const [title, setTitle] = useState(initialSetlist?.title || "");
  const [description, setDescription] = useState(initialSetlist?.description || "");
  const [date, setDate] = useState(initialSetlist?.date || "");
  const [songs, setSongs] = useState<SetlistItem[]>(initialSetlist?.songs || []);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const songCount = songs.filter(isSongItem).length;
  const songMap = new Map(availableSongs.map((s) => [s.id, s]));

  const addSong = useCallback(
    (songId: string) => {
      if (songCount >= MAX_SONGS) {
        setError(t('setlist.maxSongsReached', { count: MAX_SONGS }));
        return;
      }
      const song = songMap.get(songId);
      if (!song) return;
      const lang = song.translations[0] || "en";
      setSongs((prev) => [...prev, { type: "song", songId, lang }]);
      setSearch("");
    },
    [songMap, songCount, t]
  );

  const addNote = useCallback(() => {
    setSongs((prev) => [...prev, { type: "note", id: newItemId(), text: "" }]);
  }, []);

  const addLink = useCallback(() => {
    setSongs((prev) => [...prev, { type: "link", id: newItemId(), url: "", title: "" }]);
  }, []);

  const updateItem = useCallback((index: number, patch: Partial<SetlistItem>) => {
    setSongs((prev) =>
      prev.map((s, i) => (i === index ? ({ ...s, ...patch } as SetlistItem) : s))
    );
  }, []);

  const removeSong = useCallback((index: number) => {
    setSongs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const changeLang = useCallback((index: number, lang: string) => {
    setSongs((prev) =>
      prev.map((s, i) => (i === index && isSongItem(s) ? { ...s, lang } : s))
    );
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    setSongs((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setSongs((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  // Drag-and-drop handlers
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === targetIndex) return;
      setSongs((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
      setDragIndex(targetIndex);
    },
    [dragIndex]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    for (const s of songs) {
      if (!isLinkItem(s)) continue;
      const check = isHttpUrl(s.url.trim())
        ? validateLinkUrl(s.url.trim(), { allowedHosts: allowedLinkHosts, allowHttp: allowHttpLinks })
        : { ok: false as const, reason: t("setlist.invalidUrl") };
      if (!check.ok) {
        setError(`${s.url}: ${check.reason}`);
        return;
      }
    }
    setSaving(true);
    setError(null);

    try {
      // Drop empty notes; normalise link fields
      const items = songs
        .filter((s) => !(isNoteItem(s) && !s.text.trim()))
        .map((s) =>
          isLinkItem(s) ? { ...s, url: s.url.trim(), title: s.title?.trim() || undefined } : s
        );
      const payload = {
        ...(initialSetlist?.id && { id: initialSetlist.id }),
        title: title.trim(),
        description: description.trim() || undefined,
        date: date.trim() || undefined,
        songs: items,
      };

      const res = await fetch("/api/setlists", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }

      const saved = await res.json();
      router.push(`/setlists/${saved.id}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const lowerSearch = search.toLowerCase();
  const filteredSongs = search.trim()
    ? availableSongs.filter(
        (s) =>
          s.title.toLowerCase().includes(lowerSearch) ||
          s.id.toLowerCase().includes(lowerSearch)
      )
    : [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Metadata */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunday Service"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes..."
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Song list */}
      <div>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          Songs ({songCount} / {MAX_SONGS})
        </h2>

        {songs.length > 0 && (
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden mb-4">
            {songs.map((item, index) => {
              const meta = isSongItem(item) ? songMap.get(item.songId) : undefined;
              return (
                <div
                  key={isSongItem(item) ? `${item.songId}-${index}` : item.id}
                  draggable={isSongItem(item)}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0 cursor-grab active:cursor-grabbing ${
                    dragIndex === index
                      ? "bg-blue-50 dark:bg-blue-950"
                      : "bg-white dark:bg-neutral-950"
                  }`}
                >
                  {/* Drag handle + number */}
                  <span className="text-xs text-neutral-400 w-6 text-right font-mono select-none">
                    {index + 1}
                  </span>

                  {isNoteItem(item) ? (
                    <div className="flex-1 min-w-0">
                      <label className="text-xs text-neutral-400 block mb-1">
                        {t("setlist.noteLabel")}
                      </label>
                      <textarea
                        value={item.text}
                        onChange={(e) => updateItem(index, { text: e.target.value })}
                        maxLength={SETLIST_NOTE_MAX_LENGTH}
                        rows={3}
                        className="w-full px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-sm font-mono"
                        data-testid="setlist-note-input"
                      />
                    </div>
                  ) : isLinkItem(item) ? (
                    <div className="flex-1 min-w-0 space-y-1">
                      <input
                        type="url"
                        value={item.url}
                        onChange={(e) => updateItem(index, { url: e.target.value })}
                        maxLength={SETLIST_LINK_MAX_LENGTH}
                        placeholder={t("setlist.linkUrl")}
                        className="w-full px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-sm"
                        data-testid="setlist-link-url"
                      />
                      <input
                        type="text"
                        value={item.title ?? ""}
                        onChange={(e) => updateItem(index, { title: e.target.value })}
                        maxLength={SETLIST_LINK_TITLE_MAX_LENGTH}
                        placeholder={t("setlist.linkTitle")}
                        className="w-full px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-sm"
                      />
                    </div>
                  ) : (
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {meta?.title || item.songId}
                    </span>
                    {meta?.key && (
                      <span className="text-xs text-neutral-400">
                        Key: {meta.key}
                      </span>
                    )}
                  </div>
                  )}

                  {/* Language picker */}
                  {!isSongItem(item) ? (
                    <span className="text-xs px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-500">
                      {isNoteItem(item) ? t("setlist.itemNote") : t("setlist.itemLink")}
                    </span>
                  ) : meta && meta.translations.length > 1 ? (
                    <select
                      value={item.lang}
                      onChange={(e) => changeLang(index, e.target.value)}
                      className="text-xs px-1.5 py-0.5 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
                    >
                      {meta.translations.map((lang) => (
                        <option key={lang} value={lang}>
                          {languageLabel(lang)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-500">
                      {languageLabel(item.lang)}
                    </span>
                  )}

                  {/* Move buttons */}
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="text-neutral-400 hover:text-neutral-600 disabled:opacity-30 p-0.5"
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === songs.length - 1}
                      className="text-neutral-400 hover:text-neutral-600 disabled:opacity-30 p-0.5"
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeSong(index)}
                    className="text-neutral-400 hover:text-red-500 transition-colors p-0.5"
                    title="Remove"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add note / link */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={addNote}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            + {t("setlist.addNote")}
          </button>
          {allowedLinkHosts.length > 0 ? (
            <button
              type="button"
              onClick={addLink}
              className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              + {t("setlist.addLink")}
            </button>
          ) : (
            <span className="text-xs text-neutral-500 self-center" data-testid="links-disabled-hint">
              {t("setlist.linksDisabledHint")}
            </span>
          )}
        </div>

        {/* Add songs */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={songCount >= MAX_SONGS ? t('setlist.maxSongsReached', { count: MAX_SONGS }) : "Search songs to add..."}
            disabled={songCount >= MAX_SONGS}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {filteredSongs.length > 0 && songCount < MAX_SONGS && (
            <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto border border-neutral-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 shadow-lg">
              {filteredSongs.slice(0, 20).map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => addSong(song.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                >
                  <span className="flex-1 truncate">{song.title}</span>
                  {song.key && (
                    <span className="text-xs text-neutral-400">{song.key}</span>
                  )}
                  <div className="flex gap-0.5">
                    {song.translations.map((lang) => (
                      <span
                        key={lang}
                        className="text-[10px] px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-500"
                      >
                        {languageLabel(lang)}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
          {songCount >= MAX_SONGS && (
            <p className="mt-2 text-xs text-neutral-500 text-center">
              {t('setlist.maxSongsReached', { count: MAX_SONGS })}
            </p>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : isNew ? "Create Setlist" : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
