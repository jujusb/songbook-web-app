import { notFound, redirect } from "next/navigation";
import { getAlbum, listSongs, listArtists, getLanguagesConfig, resolveSongListTitle } from "@/lib/content";
import { getSession, canEdit } from "@/lib/auth";
import { AlbumForm } from "@/components/AlbumForm";

export default async function EditAlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");

  const { albumId } = await params;

  let album;
  try {
    album = await getAlbum(albumId);
  } catch {
    notFound();
  }

  const [songs, artists, langConfig] = await Promise.all([
    listSongs(),
    listArtists(),
    getLanguagesConfig(),
  ]);

  return (
    <AlbumForm
      initialAlbum={{
        id: album.id,
        title: album.title,
        titles: album.titles ?? {},
        artist: album.artist,
        year: album.year?.toString() || "",
        description: album.description || "",
        tags: album.tags.join(", "),
        songs: album.songs,
      }}
      allSongs={songs.map((s) => ({ id: s.id, title: resolveSongListTitle(s, langConfig.default), key: s.key }))}
      allArtists={artists.map((a) => ({ id: a.id, name: a.name }))}
      languages={langConfig.languages.map((l) => ({ code: l.code, label: l.label }))}
      defaultLang={langConfig.default}
      isNew={false}
    />
  );
}
