"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { T } from "@/components/Translate";

interface Album {
  id: string;
  title: string;
  titles?: Record<string, string>;
  artist: string;
  year?: number;
  number?: number;
  tags: string[];
  songs: string[];
  published?: boolean;
}

interface Artist {
  id: string;
  name: string;
}

interface SongSummary {
  id: string;
  translations: string[];
}

interface AlbumWithCount extends Album {
  songCount: number;
}

export function AlbumsPageClient({
  initialAlbums,
  initialArtists,
  initialSongs,
  langConfig,
  showEditActions,
}: {
  initialAlbums: Album[];
  initialArtists: Artist[];
  initialSongs: SongSummary[];
  langConfig: { default: string; languages: string[] };
  showEditActions: boolean;
}) {
  const { t, locale } = useTranslation();
  const [albums] = useState(initialAlbums);
  const [artists] = useState(initialArtists);
  const [songLangMap] = useState(
    new Map(initialSongs.map((s) => [s.id, s.translations]))
  );
  const artistMap = new Map(artists.map((a) => [a.id, a.name]));

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "title-asc" | "title-desc" | "year-asc" | "year-desc" | "number-asc" | "number-desc" | "id-asc" | "id-desc"
  >("title-asc");
  const [filterArtist, setFilterArtist] = useState<string>("");

  const uiLang = locale;

  const visibleAlbums = albums
    .map((album) => {
      const songCount =
        uiLang === langConfig.default
          ? album.songs.length
          : album.songs.filter((songId) =>
              songLangMap.get(songId)?.includes(uiLang)
            ).length;
      if (songCount === 0) return null;
      return { ...album, songCount } as Album & { songCount: number };
    })
    .filter((a): a is (Album & { songCount: number }) => a !== null);

  const filteredAlbums = visibleAlbums.filter((album) => {
    const q = query.toLowerCase();
    const searchable = [
      album.title,
      album.id,
      artistMap.get(album.artist) || album.artist,
      ...album.tags,
      ...(album.titles ? Object.values(album.titles) : []),
    ];
    const matchesSearch = q ? searchable.some((s) => s.toLowerCase().includes(q)) : true;
    const matchesArtist = filterArtist
      ? album.artist === filterArtist
      : true;
    return matchesSearch && matchesArtist;
  });

  const sortedAlbums = [...filteredAlbums].sort((a, b) => {
    if (sortBy === "title-asc") {
      return (a.titles?.[uiLang] || a.title).localeCompare(b.titles?.[uiLang] || b.title);
    }
    if (sortBy === "title-desc") {
      return (b.titles?.[uiLang] || b.title).localeCompare(a.titles?.[uiLang] || a.title);
    }
    if (sortBy === "year-asc") {
      return (a.year ?? 0) - (b.year ?? 0);
    }
    if (sortBy === "year-desc") {
      return (b.year ?? 0) - (a.year ?? 0);
    }
    if (sortBy === "number-asc") {
      return (a.number ?? 0) - (b.number ?? 0);
    }
    if (sortBy === "number-desc") {
      return (b.number ?? 0) - (a.number ?? 0);
    }
    if (sortBy === "id-asc") {
      return a.id.localeCompare(b.id);
    }
    if (sortBy === "id-desc") {
      return b.id.localeCompare(a.id);
    }
    return 0;
  });

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold"><T k="album.title" /></h1>
        {showEditActions && (
          <Link
            href="/albums/new"
            className="text-sm px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            <T k="album.newAlbum" />
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <input
          type="text"
          placeholder={t('common.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="title-asc">Title A → Z</option>
          <option value="title-desc">Title Z → A</option>
          <option value="year-asc">Year ↑</option>
          <option value="year-desc">Year ↓</option>
          <option value="number-asc">Number ↑</option>
          <option value="number-desc">Number ↓</option>
          <option value="id-asc">ID A → Z</option>
          <option value="id-desc">ID Z → A</option>
        </select>
        <select
          value={filterArtist}
          onChange={(e) => setFilterArtist(e.target.value)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Artists</option>
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {sortedAlbums.length === 0 ? (
        <p className="text-neutral-500"><T k="album.noAlbums" /></p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedAlbums.map((album) => (
            <Link
              key={album.id}
              href={`/albums/${album.id}`}
              className="block p-5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              <h2 className="font-semibold text-lg mb-1">
                {album.titles?.[uiLang] || album.title}
              </h2>
              <p className="text-sm text-neutral-500 mb-1">
                {artistMap.get(album.artist) || album.artist}
              </p>
              <div className="flex items-center gap-3 text-xs text-neutral-400 flex-wrap">
                {album.number !== undefined && (
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded text-xs font-mono">
                    No. {album.number}
                  </span>
                )}
                {album.year && <span>{album.year}</span>}
                <span>
                  {album.songCount} song
                  {album.songCount !== 1 ? "s" : ""}
                </span>
                {album.published !== undefined && (
                  <span className={album.published ? 'text-green-500' : 'text-red-500'} title={album.published ? 'Published' : 'Unpublished'}>
                    {album.published ? '✓ Published' : '✗ Unpublished'}
                  </span>
                )}
              </div>
              {album.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {album.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-600 dark:text-neutral-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
