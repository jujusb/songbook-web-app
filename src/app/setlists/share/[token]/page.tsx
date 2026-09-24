import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  findSetlistByShareToken,
  getSong,
  getSongTranslations,
  getSongTitle,
  getLanguagesConfig,
  shouldShowSongInLanguage,
} from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSetlistVoiceShares } from "@/lib/navidrome/setlist-shares";
import { SetlistReadOnlyView } from "@/components/SetlistReadOnlyView";
import { SetlistVoicePlaylists } from "@/components/SetlistVoicePlaylists";

/**
 * Share link page for a setlist. The URL carries a share token (or custom
 * slug) instead of the setlist's internal id, so the setlist's name is never
 * part of the link. Anyone holding the link can view the read-only setlist —
 * no login required — making this the target of links shared to the
 * read-only/public instance.
 */
export default async function SetlistSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const setlist = await findSetlistByShareToken(token);
  if (!setlist) notFound();

  const langConfig = await getLanguagesConfig();
  const selectedLang = getLocale(await cookies(), langConfig.default);

  const songDetails = await Promise.all(
    setlist.songs.map(async (item) => {
      try {
        const meta = await getSong(item.songId);
        const translations = await getSongTranslations(item.songId);
        return {
          ...item,
          title: await getSongTitle(item.songId, item.lang),
          key: meta.key,
          translations,
        };
      } catch {
        return {
          ...item,
          title: item.songId,
          key: undefined,
          translations: [] as string[],
        };
      }
    })
  );

  const visible = songDetails.filter((song) =>
    shouldShowSongInLanguage(song.translations, selectedLang, langConfig.default)
  );

  const voiceShares = await getSetlistVoiceShares(setlist);
  const presentHref = `/setlists/share/${encodeURIComponent(token)}/present`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/setlists"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
      >
        &larr; All Setlists
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{setlist.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500">
            {setlist.date && <span>{setlist.date}</span>}
            <span>
              {visible.length} song{visible.length !== 1 ? "s" : ""}
            </span>
          </div>
          {setlist.description && (
            <p className="text-neutral-500 mt-1 text-sm">{setlist.description}</p>
          )}
        </div>
        {setlist.songs.length > 0 && (
          <Link
            href={presentHref}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Present
          </Link>
        )}
      </div>

      <SetlistVoicePlaylists
        setlistId={setlist.id}
        shares={voiceShares}
        canGenerate={false}
      />

      <SetlistReadOnlyView
        songs={songDetails}
        selectedLang={selectedLang}
        defaultLang={langConfig.default}
      />
    </div>
  );
}