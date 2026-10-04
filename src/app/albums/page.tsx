import Link from "next/link";
import { cookies } from "next/headers";
import { listAlbums, listArtists, listSongs, getLanguagesConfig } from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canEdit } from "@/lib/auth";
import { AlbumsPageClient } from "@/components/AlbumsPageClient";
import { T } from "@/components/Translate";

export default async function AlbumsPage() {
  const [albums, artists, songs, langConfig] = await Promise.all([
    listAlbums(),
    listArtists(),
    listSongs(),
    getLanguagesConfig(),
  ]);
  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);

  return (
    <AlbumsPageClient
      initialAlbums={albums}
      initialArtists={artists}
      initialSongs={songs.map(s => ({ id: s.id, translations: s.translations }))}
      langConfig={langConfig}
      showEditActions={showEditActions}
    />
  );
}
