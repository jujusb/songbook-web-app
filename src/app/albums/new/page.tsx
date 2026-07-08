import { redirect } from "next/navigation";
import { listSongs, listArtists, ensureVariousArtists } from "@/lib/content";
import { getSession, canEdit } from "@/lib/auth";
import { AlbumForm } from "@/components/AlbumForm";

export default async function NewAlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ artist?: string }>;
}) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");

  const { artist: preselectedArtist } = await searchParams;
  await ensureVariousArtists();
  const [songs, artists] = await Promise.all([listSongs(), listArtists()]);

  return (
    <AlbumForm
      initialAlbum={{
        id: "",
        title: "",
        artist: preselectedArtist || "various-artists",
        year: "",
        description: "",
        tags: "",
        songs: [],
      }}
      allSongs={songs.map((s) => ({ id: s.id, title: s.title, key: s.key }))}
      allArtists={artists.map((a) => ({ id: a.id, name: a.name }))}
      isNew={true}
    />
  );
}
