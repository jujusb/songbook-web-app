import { notFound, redirect } from "next/navigation";
import { listSongs, listArtists, getLanguagesConfig, ensureVariousArtists } from "@/lib/content";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { AlbumForm } from "@/components/AlbumForm";

export default async function NewAlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ artist?: string }>;
}) {
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");

  const { artist: preselectedArtist } = await searchParams;
  await ensureVariousArtists();
  const [songs, artists, langConfig] = await Promise.all([
    listSongs(),
    listArtists(),
    getLanguagesConfig(),
  ]);

  return (
    <AlbumForm
      initialAlbum={{
        id: "",
        title: "",
        titles: {},
        artist: preselectedArtist || "various-artists",
        year: "",
        description: "",
        tags: "",
        songs: [],
      }}
      allSongs={songs.map((s) => ({ id: s.id, title: s.title, key: s.key }))}
      allArtists={artists.map((a) => ({ id: a.id, name: a.name }))}
      languages={langConfig.languages}
      defaultLang={langConfig.default}
      isNew={true}
    />
  );
}
