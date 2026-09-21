"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Song {
  id: string;
  title: string;
  key?: string;
}

interface ArtistOption {
  id: string;
  name: string;
}

export function AlbumForm({
  initialAlbum,
  allSongs,
  allArtists,
  languages,
  defaultLang,
  isNew,
}: {
  initialAlbum: {
    id: string;
    title: string;
    titles: Record<string, string>;
    artist: string;
    year: string;
    description: string;
    tags: string;
    songs: string[];
  };
  allSongs: Song[];
  allArtists: ArtistOption[];
  languages: { code: string; label: string }[];
  defaultLang: string;
  isNew: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialAlbum.title);
  const [titles, setTitles] = useState<Record<string, string>>(
    initialAlbum.titles
  );
  const [titleTab, setTitleTab] = useState(defaultLang);
  const [artist, setArtist] = useState(initialAlbum.artist);
  const [year, setYear] = useState(initialAlbum.year);
  const [description, setDescription] = useState(initialAlbum.description);
  const [tags, setTags] = useState(initialAlbum.tags);
  const [selectedSongs, setSelectedSongs] = useState<string[]>(initialAlbum.songs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSongs = allSongs.filter((s) => !selectedSongs.includes(s.id));

  const addSong = useCallback((songId: string) => {
    setSelectedSongs((prev) => [...prev, songId]);
  }, []);

  const removeSong = useCallback((songId: string) => {
    setSelectedSongs((prev) => prev.filter((id) => id !== songId));
  }, []);

  const moveSong = useCallback((index: number, direction: -1 | 1) => {
    setSelectedSongs((prev) => {
      const newList = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= newList.length) return prev;
      [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
      return newList;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!artist) {
      setError("Artist is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const id = isNew
        ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        : initialAlbum.id;

      const res = await fetch("/api/albums", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: title.trim(),
          titles: Object.fromEntries(
            Object.entries(titles)
              .map(([lang, value]) => [lang, value.trim()])
              .filter(([, value]) => value)
          ),
          artist,
          year: year ? parseInt(year) : undefined,
          description: description.trim() || undefined,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          songs: selectedSongs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save album");
      }

      router.push(`/albums/${id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [title, titles, artist, year, description, tags, selectedSongs, isNew, initialAlbum.id, router]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {isNew ? "New Album" : `Edit: ${initialAlbum.title}`}
      </h1>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Album title"
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <span className="block text-sm mb-1">
              Title in other languages
            </span>
            <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800 min-h-[2.5rem]">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setTitleTab(lang.code)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    lang.code === titleTab
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-neutral-500 hover:text-foreground hover:border-neutral-300"
                  }`}
                >
                  {lang.code.toUpperCase()}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={titles[titleTab] ?? ""}
              onChange={(e) =>
                setTitles((prev) => ({ ...prev, [titleTab]: e.target.value }))
              }
              placeholder={`${titles[titleTab]?.trim() ? "Title" : "No title"} in ${titleTab.toUpperCase()} (falls back to default)`}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Artist *
            </label>
            <select
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an artist...</option>
              {allArtists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="hymns, worship, traditional"
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this album..."
            rows={3}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Song ordering */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Songs</h2>

        {selectedSongs.length > 0 ? (
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden mb-4">
            <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {selectedSongs.map((songId, index) => {
                const song = allSongs.find((s) => s.id === songId);
                return (
                  <li
                    key={songId}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="text-sm text-neutral-400 w-6 text-right font-mono">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium">
                      {song?.title || songId}
                      {song?.key && (
                        <span className="ml-1 text-neutral-400 text-xs">
                          ({song.key})
                        </span>
                      )}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveSong(index, -1)}
                        disabled={index === 0}
                        className="w-7 h-7 flex items-center justify-center rounded border border-neutral-300 dark:border-neutral-700 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &uarr;
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSong(index, 1)}
                        disabled={index === selectedSongs.length - 1}
                        className="w-7 h-7 flex items-center justify-center rounded border border-neutral-300 dark:border-neutral-700 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &darr;
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSong(songId)}
                        className="w-7 h-7 flex items-center justify-center rounded border border-red-300 dark:border-red-800 text-red-500 text-xs hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        &times;
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 mb-4">
            No songs added yet. Select songs from the list below.
          </p>
        )}

        {availableSongs.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-neutral-500 mb-2">
              Add songs:
            </label>
            <div className="flex flex-wrap gap-2">
              {availableSongs.map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => addSong(song.id)}
                  className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                >
                  + {song.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim() || !artist}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : isNew ? "Create Album" : "Save Album"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/albums")}
          className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
