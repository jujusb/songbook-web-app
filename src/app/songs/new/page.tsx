import { notFound, redirect } from "next/navigation";
import { listAlbums, listArtists, getLanguagesConfig } from "@/lib/content";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { NewSongForm } from "@/components/NewSongForm";

export default async function NewSongPage({
  searchParams,
}: {
  searchParams: Promise<{ album?: string }>;
}) {
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");
  const { album: preselectedAlbum } = await searchParams;
  const [albums, artists, langConfig] = await Promise.all([
    listAlbums(),
    listArtists(),
    getLanguagesConfig(),
  ]);
  const artistMap = new Map(artists.map((a) => [a.id, a.name]));

  const albumOptions = albums.map((a) => ({
    id: a.id,
    title: a.title,
    artist: artistMap.get(a.artist) || a.artist,
  }));

  return (
    <NewSongForm
      albums={albumOptions}
      languages={langConfig.languages}
      defaultLang={langConfig.default}
      preselectedAlbum={preselectedAlbum}
    />
  );
}
