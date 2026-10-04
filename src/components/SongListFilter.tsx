"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { resolveSongListTitle } from "@/lib/song-titles";

interface Song {
  id: string;
  title: string;
  titles?: Record<string, string>;
  choTitles?: Record<string, string>;
  key?: string;
  tags: string[];
  translations: string[];
}

interface Album {
  id: string;
  title: string;
  artist: string;
  songs: string[];
}

interface Artist {
  id: string;
  name: string;
}

export function SongListFilter({
  songs,
  defaultLang,
  albums = [],
  artists = [],
}: {
  songs: Song[];
  defaultLang: string;
  albums?: Album[];
  artists?: Artist[];
}) {
  const { t, locale } = useTranslation();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"title-asc" | "title-desc" | "id-asc" | "id-desc">("title-asc");
  const [filterAlbum, setFilterAlbum] = useState<string>("");
  const [filterArtist, setFilterArtist] = useState<string>("");

  const activeLang = locale;

  const langFiltered = songs.filter(
    (song) =>
      activeLang === defaultLang || song.translations.includes(activeLang)
  );

  const filtered = langFiltered.filter((song) => {
    const q = query.toLowerCase();
    const searchable = [
      song.title,
      song.id,
      ...song.tags,
      ...(song.titles ? Object.values(song.titles) : []),
    ];
    const matchesSearch = q ? searchable.some((s) => s.toLowerCase().includes(q)) : true;
    const matchesAlbum = filterAlbum
      ? albums.some((a) => a.id === filterAlbum && a.songs.includes(song.id))
      : true;
    const matchesArtist = filterArtist
      ? albums.some(
          (a) => a.artist === filterArtist && a.songs.includes(song.id)
        )
      : true;
    return matchesSearch && matchesAlbum && matchesArtist;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "title-asc") {
      return resolveSongListTitle(a, activeLang).localeCompare(resolveSongListTitle(b, activeLang));
    }
    if (sortBy === "title-desc") {
      return resolveSongListTitle(b, activeLang).localeCompare(resolveSongListTitle(a, activeLang));
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
    <>
      <div className="flex flex-wrap gap-2 mb-4">
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
          <option value="title-asc">A → Z</option>
          <option value="title-desc">Z → A</option>
          <option value="id-asc">ID (A → Z)</option>
          <option value="id-desc">ID (Z → A)</option>
        </select>
        <select
          value={filterAlbum}
          onChange={(e) => setFilterAlbum(e.target.value)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Albums</option>
          {albums.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((song) => (
          <Link
            key={song.id}
            href={`/songs/${song.id}`}
            className="block p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
          >
            <h2 className="font-semibold mb-1">
              {resolveSongListTitle(song, activeLang)}
            </h2>
            {song.key && (
              <span className="text-sm text-neutral-500 mr-3">
                {t('common.key')}: {song.key}
              </span>
            )}
            {song.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {song.tags.map((tag) => (
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
        {sorted.length === 0 && (
          <p className="text-neutral-500 col-span-full">{t('browse.noSongs')}</p>
        )}
      </div>
    </>
  );
}