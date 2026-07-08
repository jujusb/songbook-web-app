import { notFound } from "next/navigation";
import { getAlbum, listSongs, listArtists } from "@/lib/content";
import { AlbumForm } from "@/components/AlbumForm";

export default async function EditAlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;

  let album;
  try {
    album = await getAlbum(albumId);
  } catch {
    notFound();
  }

  const [songs, artists] = await Promise.all([listSongs(), listArtists()]);

  return (
    <AlbumForm
      initialAlbum={{
        id: album.id,
        title: album.title,
        artist: album.artist,
        year: album.year?.toString() || "",
        description: album.description || "",
        tags: album.tags.join(", "),
        songs: album.songs,
      }}
      allSongs={songs.map((s) => ({ id: s.id, title: s.title, key: s.key }))}
      allArtists={artists.map((a) => ({ id: a.id, name: a.name }))}
      isNew={false}
    />
  );
}
