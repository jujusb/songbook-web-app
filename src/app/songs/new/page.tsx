import { listAlbums, listArtists } from "@/lib/content";
import { NewSongForm } from "@/components/NewSongForm";

export default async function NewSongPage({
  searchParams,
}: {
  searchParams: Promise<{ album?: string }>;
}) {
  const { album: preselectedAlbum } = await searchParams;
  const [albums, artists] = await Promise.all([listAlbums(), listArtists()]);
  const artistMap = new Map(artists.map((a) => [a.id, a.name]));

  const albumOptions = albums.map((a) => ({
    id: a.id,
    title: a.title,
    artist: artistMap.get(a.artist) || a.artist,
  }));

  return <NewSongForm albums={albumOptions} preselectedAlbum={preselectedAlbum} />;
}
