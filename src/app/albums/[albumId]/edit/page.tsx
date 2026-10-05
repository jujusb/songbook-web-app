import { notFound, redirect } from "next/navigation";
import { getAlbum, listSongs, listArtists, getLanguagesConfig, resolveSongListTitle } from "@/lib/content";
import { getSession, canEdit, canEditAlbum, getCurrentUser } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { AlbumForm } from "@/components/AlbumForm";

export default async function EditAlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  if (isReadOnly()) notFound();
  const session = await getSession();
  const user = await getCurrentUser();
  const { albumId } = await params;
  if (!canEdit(session?.role ?? null) && !canEditAlbum(user, albumId, (await getLanguagesConfig()).default)) redirect("/login");

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
        number: album.number,
        description: album.description || "",
        tags: album.tags.join(", "),
        songs: album.songs,
        spotify: album.spotify,
        youtube: album.youtube,
        youtubePlaylist: album.youtubePlaylist,
      }}
      allSongs={songs.map((s) => ({ id: s.id, title: resolveSongListTitle(s, langConfig.default), key: s.key }))}
      allArtists={artists.map((a) => ({ id: a.id, name: a.name }))}
      languages={langConfig.languages}
      defaultLang={langConfig.default}
      isNew={false}
    />
  );
}
