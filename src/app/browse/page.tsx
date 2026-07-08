import {
  listArtists,
  listAlbums,
  listSongs,
  getSongTranslations,
} from "@/lib/content";
import { BrowseTree, type TreeData } from "@/components/BrowseTree";

export default async function BrowsePage() {
  const [artists, albums, songs] = await Promise.all([
    listArtists(),
    listAlbums(),
    listSongs(),
  ]);

  // Get translations for all songs
  const songsWithTranslations = await Promise.all(
    songs.map(async (song) => {
      try {
        const translations = await getSongTranslations(song.id);
        return { ...song, translations };
      } catch {
        return { ...song, translations: [] as string[] };
      }
    })
  );

  const songMap = new Map(songsWithTranslations.map((s) => [s.id, s]));

  // Build strict Artist > Album > Song tree
  const treeArtists = artists.map((artist) => {
    const artistAlbums = albums
      .filter((a) => a.artist === artist.id)
      .map((album) => {
        const albumSongs = album.songs
          .map((songId) => {
            const song = songMap.get(songId);
            if (!song) return null;
            return {
              id: song.id,
              title: song.title,
              key: song.key,
              translations: song.translations,
            };
          })
          .filter(Boolean) as {
          id: string;
          title: string;
          key?: string;
          translations: string[];
        }[];

        return {
          id: album.id,
          title: album.title,
          year: album.year,
          songs: albumSongs,
        };
      });

    return {
      id: artist.id,
      name: artist.name,
      albums: artistAlbums,
    };
  });

  const treeData: TreeData = {
    artists: treeArtists,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Browse</h1>
        <a
          href="/artists/new"
          className="text-sm px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          + Artist
        </a>
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        Artists, albums, and songs organized as a tree.
      </p>
      <BrowseTree data={treeData} />
    </div>
  );
}
