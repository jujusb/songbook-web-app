"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

export interface TreeSong {
  id: string;
  title: string;
  titles?: Record<string, string>;
  choTitles?: Record<string, string>;
  key?: string;
  translations: string[];
  hasVoices: boolean;
  hasPartitions: boolean;
}

export interface TreeAlbum {
  id: string;
  title: string;
  titles?: Record<string, string>;
  year?: number;
  number?: number;
  songs: TreeSong[];
}

export interface TreeArtist {
  id: string;
  name: string;
  albums: TreeAlbum[];
}

export interface TreeData {
  artists: TreeArtist[];
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function DeleteButton({
  onDelete,
  label,
}: {
  onDelete: () => void;
  label: string;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="flex items-center gap-1 text-[11px]">
        <span className="text-red-500">{t('common.deleteQuestion')}</span>
        <button
          type="button"
          onClick={onDelete}
          className="text-red-600 font-semibold hover:underline"
        >
          {t('common.yes')}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-neutral-400 hover:underline"
        >
          {t('common.no')}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-[11px] text-neutral-400 hover:text-red-500 transition-colors"
      title={`${t('common.delete')} ${label}`}
    >
      &times;
    </button>
  );
}

function SongNode({
  song,
  albumId,
  onRefresh,
  canEdit,
}: {
  song: TreeSong;
  albumId: string;
  onRefresh: () => void;
  canEdit: boolean;
}) {
  const { t, locale, languageLabel } = useTranslation();
  const displayLang = song.translations.includes(locale) ? locale : (song.translations[0] || "en");
  const displayTitle =
    song.titles?.[displayLang] ||
    song.choTitles?.[displayLang] ||
    song.title;
  const handleDelete = useCallback(async () => {
    await fetch(`/api/songs?id=${song.id}`, { method: "DELETE" });
    onRefresh();
  }, [song.id, onRefresh]);

  return (
    <div className="flex items-center gap-2 py-1.5 pl-2 group">
      <svg
        className="w-4 h-4 text-neutral-400 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
        />
      </svg>
      <Link
        href={`/songs/${song.id}`}
        className="text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-1 min-w-0"
      >
        {displayTitle}
      </Link>
      {song.key && (
        <span className="text-xs text-neutral-400 shrink-0">{song.key}</span>
      )}
      <div className="flex gap-0.5 shrink-0">
        {song.translations.map((lang) => (
          <span
            key={lang}
            className={`text-[10px] px-1 py-0.5 rounded ${
              lang === displayLang
                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
            }`}
          >
            {languageLabel(lang)}
          </span>
        ))}
      </div>
      <div className="flex gap-0.5 shrink-0">
        {song.hasVoices && (
          <span
            className="text-[10px] px-1 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
            title={t('browse.voicesHint')}
          >
            {t('browse.voices')}
          </span>
        )}
        {song.hasPartitions && (
          <span
            className="text-[10px] px-1 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
            title={t('partitions.title')}
          >
            {t('browse.instrumental')}
          </span>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Link
            href={`/edit/${song.id}/${displayLang}`}
            className="text-[11px] text-neutral-400 hover:text-blue-500"
            title={t('browse.editSongTitle')}
          >
            {t('common.edit')}
          </Link>
          <DeleteButton onDelete={handleDelete} label={song.title} />
        </div>
      )}
    </div>
  );
}

function AlbumNode({
  album,
  onRefresh,
  canEdit,
}: {
  album: TreeAlbum;
  onRefresh: () => void;
  canEdit: boolean;
}) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleDelete = useCallback(async () => {
    await fetch(`/api/albums?id=${album.id}`, { method: "DELETE" });
    onRefresh();
  }, [album.id, onRefresh]);

  return (
    <div>
      <div className="flex items-center group">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 py-1.5 pl-1 flex-1 min-w-0 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded transition-colors"
        >
          <ChevronIcon open={open} />
          <svg
            className="w-4 h-4 text-blue-500 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span className="text-sm font-medium flex-1 min-w-0 truncate">
            {album.titles?.[locale] || album.title}
          </span>
          {album.number !== undefined && (
            <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded text-[10px] font-mono">
              No. {album.number}
            </span>
          )}
          {album.year && (
            <span className="text-xs text-neutral-400 shrink-0">
              {album.year}
            </span>
          )}
          <span className="text-xs text-neutral-400 shrink-0">
            {t('album.count', { n: album.songs.length })}
          </span>
        </button>
        {canEdit && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
            <Link
              href={`/songs/new?album=${album.id}`}
              className="text-[11px] text-green-600 hover:text-green-500 font-medium"
              title={t('browse.addSongTitle')}
            >
              {t('browse.addSong')}
            </Link>
            <Link
              href={`/albums/${album.id}/edit`}
              className="text-[11px] text-neutral-400 hover:text-blue-500"
              title={t('browse.editAlbumTitle')}
            >
              {t('common.edit')}
            </Link>
            <DeleteButton onDelete={handleDelete} label={album.title} />
          </div>
        )}
      </div>
      {open && (
        <div className="ml-6 border-l border-neutral-200 dark:border-neutral-800 pl-3">
          {album.songs.length === 0 ? (
            <p className="text-xs text-neutral-400 py-1 pl-2">{t('album.empty')}</p>
          ) : (
            album.songs.map((song) => (
              <SongNode
                key={song.id}
                song={song}
                albumId={album.id}
                onRefresh={onRefresh}
                canEdit={canEdit}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ArtistNode({
  artist,
  onRefresh,
  canEdit,
}: {
  artist: TreeArtist;
  onRefresh: () => void;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const totalSongs = artist.albums.reduce(
    (sum, a) => sum + a.songs.length,
    0
  );

  const handleDelete = useCallback(async () => {
    await fetch(`/api/artists?id=${artist.id}`, { method: "DELETE" });
    onRefresh();
  }, [artist.id, onRefresh]);

  return (
    <div>
      <div className="flex items-center group">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 py-2 pl-1 flex-1 min-w-0 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded transition-colors"
        >
          <ChevronIcon open={open} />
          <svg
            className="w-5 h-5 text-purple-500 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="font-semibold flex-1 min-w-0 truncate">
            {artist.name}
          </span>
          <div className="flex gap-2 text-xs text-neutral-400 shrink-0">
            <span>
              {t('artist.countAlbums', { n: artist.albums.length })}
            </span>
            <span>
              {t('artist.countSongs', { n: totalSongs })}
            </span>
          </div>
        </button>
        {canEdit && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
            <Link
              href={`/albums/new?artist=${artist.id}`}
              className="text-[11px] text-green-600 hover:text-green-500 font-medium"
              title={t('artist.addAlbumTitle')}
            >
              {t('artist.addAlbum')}
            </Link>
            <Link
              href={`/artists/${artist.id}`}
              className="text-[11px] text-neutral-400 hover:text-blue-500"
              title={t('artist.editTitle')}
            >
              {t('common.edit')}
            </Link>
            {artist.id !== "various-artists" && (
              <DeleteButton onDelete={handleDelete} label={artist.name} />
            )}
          </div>
        )}
      </div>
      {open && (
        <div className="ml-6 border-l border-neutral-200 dark:border-neutral-800 pl-3">
          {artist.albums.map((album) => (
            <AlbumNode key={album.id} album={album} onRefresh={onRefresh} canEdit={canEdit} />
          ))}
          {artist.albums.length === 0 && (
            <p className="text-xs text-neutral-400 py-1 pl-2">{t('album.noAlbumsInArtist')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function BrowseTree({ data, canEdit = false }: { data: TreeData; canEdit?: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");

  const onRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const lowerFilter = filter.toLowerCase();

  const matchesSong = (s: TreeSong) =>
    !filter ||
    s.title.toLowerCase().includes(lowerFilter) ||
    s.id.toLowerCase().includes(lowerFilter);

  const matchesAlbum = (a: TreeAlbum) =>
    !filter ||
    a.title.toLowerCase().includes(lowerFilter) ||
    a.songs.some(matchesSong);

  const matchesArtist = (a: TreeArtist) =>
    !filter ||
    a.name.toLowerCase().includes(lowerFilter) ||
    a.albums.some(matchesAlbum);

  const filteredArtists = data.artists.filter(matchesArtist);

  const totalArtists = filteredArtists.length;
  const totalAlbums = filteredArtists.reduce(
    (s, a) => s + a.albums.length,
    0
  );
  const totalSongs = filteredArtists.reduce(
    (s, a) =>
      s + a.albums.reduce((s2, al) => s2 + al.songs.length, 0),
    0
  );

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('browse.filter')}
          className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-xs text-neutral-400 shrink-0">
          {t('browse.stats', { artists: totalArtists, albums: totalAlbums, songs: totalSongs })}
        </div>
      </div>

      <div className="space-y-1">
        {filteredArtists.map((artist) => (
          <ArtistNode
            key={artist.id}
            artist={artist}
            onRefresh={onRefresh}
            canEdit={canEdit}
          />
        ))}

        {filteredArtists.length === 0 && (
          <p className="text-neutral-500 text-sm py-4">
            {filter
              ? t('browse.noResults')
              : t('browse.noContent')}
          </p>
        )}
      </div>
    </div>
  );
}
