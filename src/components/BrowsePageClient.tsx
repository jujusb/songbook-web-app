"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { T } from "@/components/Translate";
import { BrowseTree, type TreeData, type TreeArtist, type TreeAlbum, type TreeSong } from "./BrowseTree";

interface BrowsePageClientProps {
  initialTreeData: TreeData;
  showEditActions: boolean;
}

export function BrowsePageClient({
  initialTreeData,
  showEditActions,
}: BrowsePageClientProps) {
  const { t, locale } = useTranslation();
  const [query, setQuery] = useState("");

  const filteredTreeData = useMemo(() => {
    if (!query.trim()) return initialTreeData;

    const q = query.toLowerCase().trim();

    const filterSong = (song: TreeSong): boolean => {
      const searchable = [
        song.id,
        song.title,
        ...(song.titles ? Object.values(song.titles) : []),
        ...(song.choTitles ? Object.values(song.choTitles) : []),
        song.key || "",
      ];
      return searchable.some((s) => s.toLowerCase().includes(q));
    };

    const filterAlbum = (album: TreeAlbum): TreeAlbum | null => {
      const filteredSongs = album.songs.filter(filterSong);
      if (filteredSongs.length === 0) return null;
      const albumSearchable = [
        album.id,
        album.title,
        ...(album.titles ? Object.values(album.titles) : []),
        album.year?.toString() || "",
      ];
      const albumMatches = albumSearchable.some((s) => s.toLowerCase().includes(q));
      if (albumMatches) {
        return { ...album, songs: filteredSongs };
      }
      // If album doesn't match but songs do, still include it with filtered songs
      if (filteredSongs.length > 0) {
        return { ...album, songs: filteredSongs };
      }
      return null;
    };

    const filterArtist = (artist: TreeArtist): TreeArtist | null => {
      const filteredAlbums = artist.albums
        .map(filterAlbum)
        .filter((a): a is TreeAlbum => a !== null);
      if (filteredAlbums.length === 0) return null;
      const artistSearchable = [artist.id, artist.name];
      const artistMatches = artistSearchable.some((s) => s.toLowerCase().includes(q));
      if (artistMatches) {
        return { ...artist, albums: filteredAlbums };
      }
      if (filteredAlbums.length > 0) {
        return { ...artist, albums: filteredAlbums };
      }
      return null;
    };

    const filteredArtists = initialTreeData.artists
      .map(filterArtist)
      .filter((a): a is TreeArtist => a !== null);

    return { artists: filteredArtists };
  }, [initialTreeData, query]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold"><T k="browse.title" /></h1>
        {showEditActions && (
          <Link
            href="/artists/new"
            className="text-sm px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            <T k="artist.newArtist" />
          </Link>
        )}
      </div>
      <p className="text-sm text-neutral-500 mb-4">
        <T k="browse.description" />
      </p>
      <BrowseTree data={filteredTreeData} canEdit={showEditActions} />
    </div>
  );
}
