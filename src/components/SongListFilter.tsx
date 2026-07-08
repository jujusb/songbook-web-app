"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

interface Song {
  id: string;
  title: string;
  key?: string;
  tags: string[];
}

export function SongListFilter({ songs }: { songs: Song[] }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const filtered = songs.filter((song) => {
    const q = query.toLowerCase();
    return (
      song.title.toLowerCase().includes(q) ||
      song.tags.some((t) => t.toLowerCase().includes(q)) ||
      song.id.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <input
        type="text"
        placeholder={t('common.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full mb-6 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((song) => (
          <Link
            key={song.id}
            href={`/songs/${song.id}`}
            className="block p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
          >
            <h2 className="font-semibold mb-1">{song.title}</h2>
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
        {filtered.length === 0 && (
          <p className="text-neutral-500 col-span-full">{t('browse.noSongs')}</p>
        )}
      </div>
    </>
  );
}
