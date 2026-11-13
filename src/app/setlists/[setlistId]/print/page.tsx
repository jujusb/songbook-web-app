import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSetlist, getLanguagesConfig } from "@/lib/content";
import { resolveScopeSongs } from "@/lib/export/song-scope";
import { loadPrintSongs } from "@/lib/print/load";
import { PrintSongbook } from "@/components/PrintSongbook";
import { getLocale, createT, plural } from "@/lib/i18n/server";
import { getSession, canEdit, canViewSetlist } from "@/lib/auth";

export default async function SetlistPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ share?: string; lang?: string }>;
}) {
  const { setlistId } = await params;
  const { share, lang } = await searchParams;
  const shareParam = typeof share === "string" ? share : undefined;

  const setlist = await getSetlist(setlistId).catch(() => null);
  if (!setlist) notFound();

  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);
  if (!canViewSetlist(setlist, shareParam, showEditActions)) {
    notFound();
  }

  const langConfig = await getLanguagesConfig();
  const cookieLang = getLocale(await cookies(), langConfig.default);
  const t = createT(cookieLang);
  const selectedLang =
    typeof lang === "string" &&
    (lang === langConfig.default || langConfig.languages.includes(lang))
      ? lang
      : cookieLang;

  // Every setlist item pins its own language (`item.lang`), so no language
  // filtering here: the songbook always prints each song in the language the
  // setlist selected — independent of the current UI locale.
  const resolved = await resolveScopeSongs("setlist", setlistId);
  const songs = resolved.songs;

  const printSongs = await loadPrintSongs(songs, [selectedLang], false);

  const songCount = printSongs.filter((s) => s.note === undefined && !s.link).length;

  const backHref = `/setlists/${setlist.id}${
    shareParam ? `?share=${shareParam}` : ""
  }`;

  return (
    <PrintSongbook
      printSongs={printSongs}
      pageTitle={setlist.title}
      header={
        <>
          {setlist.date && <p className="text-neutral-500">{setlist.date}</p>}
          {setlist.description && (
            <p className="text-neutral-500 text-sm mt-2 mb-6">
              {setlist.description}
            </p>
          )}
        </>
      }
      tocTitle={t("setlistApp.songs")}
      showLangLabels
      backHref={backHref}
      backLabel={t("setlistDates.backToSetlist")}
      toolbarChildren={
        <span className="text-sm text-neutral-500">
          {plural(t("setlist.count", { n: songCount }), songCount)}
        </span>
      }
      emptyText={t("setlistApp.noSongsToPrint")}
    />
  );
}