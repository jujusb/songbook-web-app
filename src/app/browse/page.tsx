import { cookies } from "next/headers";
import Link from "next/link";
import {
  listArtists,
  listAlbums,
  listSongs,
  getLanguagesConfig,
  shouldShowSongInLanguage,
} from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canEdit } from "@/lib/auth";
import { hasVoiceSections } from "@/lib/navidrome/voices";
import { BrowseTree, type TreeData } from "@/components/BrowseTree";
import { T } from "@/components/Translate";

interface TreeSong {
  id: string;
  title: string;
  titles?: Record<string, string>;
  choTitles?: Record<string, string>;
  key?: string;
  translations: string[];
  hasVoices: boolean;
  hasPartitions: boolean;
}

interface TreeAlbum {
  id: string;
  title: string;
  titles?: Record<string, string>;
  year?: number;
  songs: TreeSong[];
}

interface TreeArtist {
  id: string;
  name: string;
  albums: TreeAlbum[];
}

export default async function BrowsePage() {
  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);

  const [artists, albums, songs, langConfig] = await Promise.all([
    listArtists(),
    listAlbums(),
    listSongs(),
    getLanguagesConfig(),
  ]);

  const selectedLang = getLocale(await cookies(), langConfig.default);

  const songMap = new Map(songs.map((s) => [s.id, s]));

  // Cheap flag precomputation (voice presence uses one memoized Navidrome dump).
  const voicesBySong = new Map<string, boolean>();
  for (const song of songs) {
    voicesBySong.set(song.id, await hasVoiceSections(song.id, selectedLang));
  }

  // Build strict Artist > Album > Song tree, keeping only songs that have
  // the selected language (all songs when the default language is selected).
  const treeArtists: TreeArtist[] = artists
    .map((artist) => {
      const artistAlbums: TreeAlbum[] = albums
        .filter((a) => a.artist === artist.id)
        .map((album) => {
          const albumSongs: TreeSong[] = [];
          for (const songId of album.songs) {
            const song = songMap.get(songId);
            if (!song) continue;
            if (
              !shouldShowSongInLanguage(
                song.translations,
                selectedLang,
                langConfig.default
              )
            ) {
              continue;
            }
            albumSongs.push({
              id: song.id,
              title: song.title,
              titles: song.titles,
              choTitles: song.choTitles,
              key: song.key,
              translations: song.translations,
              hasVoices: voicesBySong.get(song.id) ?? false,
              hasPartitions: (song.partitions?.length ?? 0) > 0,
            });
          }

          return {
            id: album.id,
            title: album.title,
            titles: album.titles,
            year: album.year,
            songs: albumSongs,
          };
        })
        .filter((album) => album.songs.length > 0);

      if (artistAlbums.length === 0) return null;
      return {
        id: artist.id,
        name: artist.name,
        albums: artistAlbums,
      };
    })
    .filter((a): a is TreeArtist => a !== null);

  const treeData: TreeData = {
    artists: treeArtists,
  };

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
      <p className="text-sm text-neutral-500 mb-6">
        <T k="browse.description" />
      </p>
      <BrowseTree data={treeData} canEdit={showEditActions} />
    </div>
  );
}