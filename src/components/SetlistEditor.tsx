"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { getSetlistMaxSongs } from "@/lib/config";
import { validateLinkUrl } from "@/lib/setlist-links";
import { notesApi, type NoteMetadata } from "@/lib/notes";
import { isSelectableNoteDate } from "@/lib/note-schedule";
import { RecurrentDateSelect, nearestAllowedNoteDate } from "@/components/RecurrentDateSelect";
import { DateCalendar } from "@/components/DateCalendar";
import {
  isHttpUrl,
  isSongItem,
  isNoteItem,
  isLinkItem,
  isRecurrentNoteItem,
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
  image?: string;
  date: string;
  songs: SetlistItem[];
}

interface PreviousVersion {
  label: string;
  title: string;
  description?: string;
  image?: string;
  date?: string;
  eventDate?: string;
  songs: SetlistItem[];
}

export function SetlistEditor({
   availableSongs,
   initialSetlist,
   isNew,
   linkOnly = false,
   versionLabel,
   newDate = false,
   previousVersions = [],
   currentDate = "",
   datedVersions = [],
   startEmpty = false,
   allowedLinkHosts = [],
  allowHttpLinks = false,
}: {
  allowedLinkHosts?: string[];
  allowHttpLinks?: boolean;
  availableSongs: AvailableSong[];
  initialSetlist?: SetlistData;
  isNew: boolean;
  linkOnly?: boolean;
  versionLabel?: string;
  /** When true, the form creates a new dated version instead of updating. */
  newDate?: boolean;
  /** Dated versions that can be copied into the new date. */
  previousVersions?: PreviousVersion[];
  /** Date of the current setlist; a new date may not reuse it. */
  currentDate?: string;
  /** Every dated version (label + date). Picking one of these opens it. */
  datedVersions?: Array<{ label: string; date: string }>;
  /** Start a new date with no songs (picked from an empty calendar day). */
  startEmpty?: boolean;
}) {
  const router = useRouter();
  const { languageLabel, t } = useTranslation();
  const [title, setTitle] = useState(initialSetlist?.title || "");
  const [description, setDescription] = useState(initialSetlist?.description || "");
  const [image, setImage] = useState(initialSetlist?.image || "");
  const [date, setDate] = useState(initialSetlist?.date || "");
  // New dates start from an empty setlist unless the user picks a source.
  const startFromEmpty = startEmpty || newDate;
  const [songs, setSongs] = useState<SetlistItem[]>(startFromEmpty ? [] : initialSetlist?.songs || []);
  const [copySource, setCopySource] = useState(startFromEmpty ? "empty" : "current");
  // Set right before a deliberate navigation after saving, so no prompt is shown.
  const leavingRef = useRef(false);
  // Snapshot of the form as it was opened; the form is dirty when it differs.
  const [baseline] = useState(() =>
    JSON.stringify({
      title: initialSetlist?.title || "",
      description: startFromEmpty ? "" : initialSetlist?.description || "",
      image: startFromEmpty ? "" : initialSetlist?.image || "",
      date: initialSetlist?.date || "",
      songs: startFromEmpty ? [] : initialSetlist?.songs || [],
    }),
  );
  const isDirty = JSON.stringify({ title, description, image, date, songs }) !== baseline;
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showRecurrent, setShowRecurrent] = useState(false);
  const [recurrentNotes, setRecurrentNotes] = useState<NoteMetadata[]>([]);
  const [pickNoteId, setPickNoteId] = useState("");
  const [pickChoice, setPickChoice] = useState("");

  useEffect(() => {
    let cancelled = false;
    notesApi.fetchNotes().then((notes) => {
      if (!cancelled) setRecurrentNotes(notes);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const noteTitle = (noteId: string) => recurrentNotes.find((n) => n.id === noteId)?.title || noteId;

  const pickedNote = recurrentNotes.find((n) => n.id === pickNoteId);
  const todayIso = new Date().toISOString().slice(0, 10);
  // The calendar's choice when it is allowed, otherwise the next allowed date.
  const pickDate = pickedNote
    ? isSelectableNoteDate(pickedNote, pickChoice)
      ? pickChoice
      : nearestAllowedNoteDate(pickedNote, todayIso) ?? ""
    : "";


  const songCount = songs.filter(isSongItem).length;
  const songMap = useMemo(() => new Map(availableSongs.map((s) => [s.id, s])), [availableSongs]);

  const addSong = useCallback(
    (songId: string) => {
      if (songCount >= MAX_SONGS) {
        setError(t('setlist.maxSongsReached', { count: MAX_SONGS }));
        return;
      }
      const song = songMap.get(songId);
      if (!song) return;
      const lang = song.translations[0] || "en-US";
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

  // Only dates allowed by the note's recurrence rule can be added.
  const addRecurrentNote = useCallback(() => {
    if (!pickedNote || !pickDate || !isSelectableNoteDate(pickedNote, pickDate)) return;
    setSongs((prev) => [...prev, { type: "recurrent-note", id: newItemId(), noteId: pickNoteId, date: pickDate }]);
    setShowRecurrent(false);
    setPickNoteId("");
    setPickChoice("");
    setError(null);
  }, [pickNoteId, pickedNote, pickDate]);

  const uploadSetlistImage = useCallback(async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/images", { method: "POST", body: form });
    const data = await res.json();
    if (data?.url) setImage(data.url);
  }, []);

  const applyCopySource = useCallback((source: string) => {
    setCopySource(source);
    if (source === "current") {
      setImage(initialSetlist?.image || "");
      setDescription(initialSetlist?.description || "");
      setSongs(initialSetlist?.songs || []);
      return;
    }
    if (source === "empty") {
      setImage("");
      setDescription("");
      setSongs([]);
      return;
    }
    const version = previousVersions.find((v) => v.label === source);
    if (!version) return;
    setImage(version.image || "");
    setDescription(version.description || "");
    setSongs(version.songs || []);
  }, [initialSetlist?.image, initialSetlist?.description, initialSetlist?.songs, previousVersions]);

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

  const setlistId = initialSetlist?.id;

  /** Ask before leaving with unsaved changes. Returns false when the user cancels. */
  const confirmLeave = useCallback(() => {
    if (!isDirty || leavingRef.current) return true;
    return window.confirm("You have unsaved changes. Leave this page and discard them?");
  }, [isDirty]);

  // Warn on tab close or reload while there are unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const navigate = useCallback(
    (href: string) => {
      if (!confirmLeave()) return;
      leavingRef.current = true;
      router.push(href);
    },
    [confirmLeave, router],
  );

  // Picking a day opens its saved setlist, or starts an empty setlist for it.
  const handleDatePick = useCallback(
    (picked: string) => {
      if (!setlistId) return;
      const base = `/setlists/${setlistId}/edit`;
      if (picked === currentDate) {
        if (!newDate && !versionLabel) return;
        navigate(base);
        return;
      }
      const existing = datedVersions.find((v) => v.date === picked);
      if (existing) {
        navigate(`${base}?version=${encodeURIComponent(existing.label)}`);
        return;
      }
      if (newDate) {
        if (picked === date) return;
        if (!confirmLeave()) return;
        // Show an empty setlist for the picked date.
        setDate(picked);
        setDescription("");
        setImage("");
        setSongs([]);
        setCopySource("empty");
        return;
      }
      navigate(`${base}?newDate=1&date=${encodeURIComponent(picked)}&empty=1`);
    },
    [setlistId, currentDate, datedVersions, newDate, versionLabel, date, confirmLeave, navigate],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (newDate && !date.trim()) {
      setError("Date is required");
      return;
    }
    if (newDate && currentDate && date.trim() === currentDate) {
      setError(`A setlist already uses the date ${currentDate}. Choose another date.`);
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

      if (newDate) {
        if (!initialSetlist?.id) throw new Error("Setlist not found");
        const res = await fetch(`/setlists/${initialSetlist.id}/history/new-date`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: date.trim(),
            title: title.trim(),
            description: description.trim() || undefined,
            image: image.trim() || undefined,
            songs: items,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Save failed");
        }

        const saved = await res.json().catch(() => ({}));
        const label = saved?.label || date.trim();
        leavingRef.current = true;
        router.push(`/setlists/${initialSetlist.id}?version=${encodeURIComponent(label)}`);
        router.refresh();
        return;
      }

       const payload = {
         ...(initialSetlist?.id && { id: initialSetlist.id }),
         ...(versionLabel && { version: versionLabel }),
         title: title.trim(),
        description: description.trim() || undefined,
        image: image.trim() || undefined,
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
      leavingRef.current = true;
      router.push(`/setlists/${saved.id}${versionLabel ? `?version=${encodeURIComponent(versionLabel)}` : ""}`);
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

  const backHref = isNew
    ? "/setlists"
    : initialSetlist?.id
      ? `/setlists/${initialSetlist.id}`
      : "/setlists";

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        onClick={(event) => {
          if (!confirmLeave()) {
            event.preventDefault();
            return;
          }
          leavingRef.current = true;
        }}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-block"
      >
        &larr; {newDate ? "Back to setlist" : isNew ? "Back to setlists" : "Back to setlist"}
      </Link>
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
        {!linkOnly && (
          <div>
            <label className="block text-sm font-medium mb-1">Date{newDate ? " *" : ""}</label>
            <DateCalendar
              value={date}
              isSelectable={() => true}
              marked={new Set([...datedVersions.map((v) => v.date), ...(currentDate ? [currentDate] : [])])}
              onChange={handleDatePick}
              footer={
                <>
                  Dots mark dates with a saved setlist. Picking one opens it; picking an empty day starts a new
                  setlist for that date.
                </>
              }
            />
          </div>
        )}
        {newDate && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Start from</label>
            <select
              value={copySource}
              onChange={(e) => applyCopySource(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="current">Current setlist (copy)</option>
              <option value="empty">Empty setlist</option>
              {previousVersions.map((version) => (
                <option key={version.label} value={version.label}>
                  {version.eventDate || version.date || version.label}
                  {version.title ? ` — ${version.title}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Copy the image and songs from the current setlist or a previous date, then adjust them below.
            </p>
          </div>
        )}
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
        {!linkOnly && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Image URL (optional)</label>
          <input
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) uploadSetlistImage(file);
            }}
            className="mt-2 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-md p-4 text-center text-sm text-neutral-500"
          >
            Drag & drop an image here or
            <label className="ml-2 text-blue-600 dark:text-blue-400 cursor-pointer">
              choose file
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadSetlistImage(file);
                }}
              />
            </label>
          </div>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Setlist image" className="mt-2 max-h-40 rounded" />
          )}
        </div>
        )}
      </div>

      {!linkOnly && (
        <div>
          {/* Song list */}
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          Songs ({songCount} / {MAX_SONGS})
        </h2>

        {songs.length > 0 && (
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden mb-4">
            {songs.map((item, index) => {
              const meta = isSongItem(item) ? songMap.get(item.songId) : undefined;
              return (
                <div
                  key={isSongItem(item) ? `${(item as { songId: string }).songId}-${index}` : ((item as { id?: string }).id ?? String(index))}
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
                  ) : isRecurrentNoteItem(item) ? (
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{noteTitle(item.noteId)}</span>
                      {(() => {
                        const note = recurrentNotes.find((n) => n.id === item.noteId);
                        if (!note) {
                          return <span className="text-xs text-red-600">{item.date}</span>;
                        }
                        return (
                          <div data-testid="setlist-recurrent-item-date">
                            <RecurrentDateSelect
                              note={note}
                              value={item.date}
                              autoCorrect={false}
                              onChange={(date) => updateItem(index, { date })}
                            />
                          </div>
                        );
                      })()}
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
                      {meta?.title || (isSongItem(item) ? item.songId : "")}
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
                      {isNoteItem(item) ? t("setlist.itemNote") : isRecurrentNoteItem(item) ? t("setlist.itemRecurrentNote") : t("setlist.itemLink")}
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
          <button
            type="button"
            onClick={() => setShowRecurrent((v) => !v)}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            + {t("setlist.addRecurrentNote")}
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

        {showRecurrent && (
          <div className="flex flex-wrap items-center gap-2 mb-3 p-3 border border-neutral-200 dark:border-neutral-800 rounded-md">
            <select
              value={pickNoteId}
              onChange={(e) => setPickNoteId(e.target.value)}
              className="flex-1 min-w-48 px-2 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-sm"
              aria-label={t("setlist.chooseNote")}
            >
              <option value="">{t("setlist.chooseNote")}</option>
              {recurrentNotes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
            <label className="text-xs text-neutral-500">{t("setlist.noteDate")}</label>
            {pickedNote && (
              <RecurrentDateSelect note={pickedNote} value={pickDate} onChange={setPickChoice} />
            )}
            <button
              type="button"
              onClick={addRecurrentNote}
              disabled={!pickedNote || !pickDate}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50"
            >
              {t("setlist.addRecurrentNoteConfirm")}
            </button>
          </div>
        )}

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

      )}
      {/* Save */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : isNew ? "Create Setlist" : newDate ? "Create date setlist" : "Save Changes"}
        </button>
        {!isNew && !newDate && initialSetlist?.id && (
          <button
            type="button"
            onClick={() => navigate(`/setlists/${initialSetlist.id}/edit?newDate=1`)}
            className="px-4 py-2 bg-neutral-700 text-white rounded-md text-sm hover:bg-neutral-800 transition-colors"
          >
            New date
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirmLeave()) {
              leavingRef.current = true;
              router.back();
            }
          }}
          className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
