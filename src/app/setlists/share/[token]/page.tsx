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
  getSongTranslation,
  getSetlist,
} from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, getCurrentUser } from "@/lib/auth";
import { getSetlistVoiceShares } from "@/lib/navidrome/setlist-shares";
import { SetlistReadOnlyView } from "@/components/SetlistReadOnlyView";
import { SetlistVoicePlaylists } from "@/components/SetlistVoicePlaylists";
import { SetlistPdfButton } from "@/components/SetlistPdfButton";
import { saveSharedSetlistAction } from "@/app/actions";

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

  const session = await getSession();
  const currentUser = await getCurrentUser();
  const userId = session?.userId;
  const isOwner = setlist.ownerId === userId;
  const isSubscribed = userId ? (setlist.subscribers ?? []).includes(userId) : false;

  const langConfig = await getLanguagesConfig();
  const selectedLang = getLocale(await cookies(), langConfig.default);

  // Determine source setlist (original for references)
  const isReference = !!setlist.sharedFrom;
  const sourceSetlistId = isReference ? setlist.sharedFrom!.setlistId : setlist.id;
  const sourceSetlist = isReference ? await getSetlist(sourceSetlistId) : setlist;

  const songDetails = await Promise.all(
    sourceSetlist.songs.map(async (item: { songId: string; lang: string }) => {
      try {
        const meta = await getSong(item.songId);
        const translations = await getSongTranslations(item.songId);
        const { body } = await getSongTranslation(item.songId, item.lang);
        return {
          ...item,
          title: await getSongTitle(item.songId, item.lang),
          key: meta.key,
          translations,
          body,
        };
      } catch {
        return {
          ...item,
          title: item.songId,
          key: undefined,
          translations: [] as string[],
          body: '',
        };
      }
    })
  );

  // Build songBodies map for lyrics view
  const songBodies: Record<string, string> = {};
  for (const song of songDetails) {
    if (song.body) {
      songBodies[song.songId] = song.body;
    }
  }

  // User preferences for lyrics view
  type UserPreferences = {
    showChords: boolean;
    showRepeats: boolean;
    chordNotation: "letters" | "solfege" | "roman" | "nashville";
    inlineChords: boolean;
    setlistLyricsView: "all" | "list";
    setlistTranspose: Record<string, number>;
  };

  const userPrefs: UserPreferences = currentUser ? {
    showChords: currentUser.showChords ?? true,
    showRepeats: currentUser.showRepeats ?? true,
    chordNotation: (currentUser.chordNotation as "letters" | "solfege" | "roman" | "nashville") ?? 'letters',
    inlineChords: currentUser.inlineChords ?? false,
    setlistLyricsView: currentUser.setlistLyricsView ?? 'all',
    setlistTranspose: currentUser.setlistTranspose?.[sourceSetlistId] ?? {},
  } : {
    showChords: true,
    showRepeats: true,
    chordNotation: 'letters',
    inlineChords: false,
    setlistLyricsView: 'all',
    setlistTranspose: {},
  };

  const visible = songDetails.filter((song: { translations: string[] }) =>
    shouldShowSongInLanguage(song.translations, selectedLang, langConfig.default)
  );

  const voiceShares = await getSetlistVoiceShares(sourceSetlist, 'public');
  const presentHref = `/setlists/share/${encodeURIComponent(token)}/present`;

  const handleSaveShared = async () => {
    const res = await saveSharedSetlistAction(token);
    if (res.ok) {
      window.location.href = `/setlists/${res.setlistId}`;
    }
  };

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          {isReference && (
            <p className="text-neutral-500 mt-1 text-sm">Saved from shared setlist</p>
          )}
        </div>
        <div className="flex gap-2">
          {setlist.songs.length > 0 && (
            <Link
              href={presentHref}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Present
            </Link>
          )}
          {setlist.songs.length > 0 && (
            <SetlistPdfButton
              setlistId={setlist.id}
              shareToken={setlist.shareToken}
            />
          )}
          {!isOwner && userId && !isSubscribed && !isReference && (
            <button
              onClick={handleSaveShared}
              className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Save to My Library
            </button>
          )}
        </div>
      </div>

      <SetlistVoicePlaylists
        setlistId={setlist.id}
        shares={voiceShares}
        canGenerate={false}
        preferredVoice={currentUser?.voice}
      />

      <SetlistReadOnlyView
        songs={songDetails}
        selectedLang={selectedLang}
        defaultLang={langConfig.default}
        userPreferences={userPrefs}
        songBodies={songBodies}
        isReference={isReference}
        sourceSetlistId={sourceSetlistId}
      />
    </div>
  );
}