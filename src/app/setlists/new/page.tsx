import type { Metadata } from "next";
import { getSetlistLinkAllowedHosts, getSetlistLinkAllowHttp } from "@/lib/config";
import { cookies } from "next/headers";
import { getLocale, createT } from "@/lib/i18n/server";
import { notFound, redirect } from "next/navigation";
import { getSession, canCreateSetlist } from "@/lib/auth";
import { isReadOnlyFor } from "@/lib/readonly";
import { listSongs, getSongTranslations } from "@/lib/content";
import { SetlistEditor } from "@/components/SetlistEditor";

export default async function NewSetlistPage() {
  if (isReadOnlyFor('setlist_write')) notFound();
  const session = await getSession();
  if (!canCreateSetlist(session?.role ?? null)) redirect("/login");

  const t = createT(getLocale(await cookies()));
  const songs = await listSongs();
  const songsWithLangs = await Promise.all(
    songs.map(async (s) => {
      const translations = await getSongTranslations(s.id);
      return { id: s.id, title: s.title, key: s.key, translations };
    })
  );

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("setlistApp.newSetlistTitle")}</h1>
      <SetlistEditor
        allowedLinkHosts={getSetlistLinkAllowedHosts()}
        allowHttpLinks={getSetlistLinkAllowHttp()}
        availableSongs={songsWithLangs}
        isNew={true}
        linkOnly={true}
      />
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const t = createT(getLocale(await cookies()));
  return { title: t("setlistApp.newSetlistTitle") };
}
