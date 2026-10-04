import Link from "next/link";
import { cookies } from "next/headers";
import { listAlbums, listArtists, listSongs, getLanguagesConfig } from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canEdit } from "@/lib/auth";
import { AlbumsPageClient } from "@/components/AlbumsPageClient";
import { T } from "@/components/Translate";

export default async function AlbumsPage() {
  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);

  const [albums, artists, songs, langConfig] = await Promise.all([
    listAlbums({ onlyPublished: true, role: session?.role ?? 'public' }),
    listArtists(),
    listSongs({ onlyPublished: true, role: session?.role ?? 'public' }),
    getLanguagesConfig(),
  ]);

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
