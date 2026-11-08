import { headers } from "next/headers";
import { validateLinkUrl, safeHost } from "@/lib/setlist-links";
import { getSetlistLinkAllowedHosts, getSetlistLinkAllowHttp } from "@/lib/config";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
  getSetlistVersion,
  listSetlistVersions,
} from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, getCurrentUser } from "@/lib/auth";
import { getSetlistVoiceShares } from "@/lib/navidrome/setlist-shares";
import { isSongItem, isNoteItem, isLinkItem, isRecurrentNoteItem } from "@/lib/content/schemas";
import { renderNoteRefText } from "@/lib/note-render";
import { SetlistReadOnlyView, type SetlistReadOnlyEntry } from "@/components/SetlistReadOnlyView";
import { SetlistPdfButton } from "@/components/SetlistPdfButton";
import { SetlistHistoryBrowser } from "@/components/SetlistHistoryBrowser";
import { saveSharedSetlistAction } from "@/app/actions";

/**
 * Share link page for a setlist. The URL carries a share token (or custom
 * slug) instead of the setlist's internal id, so the setlist's name is never
 * part of the link. Anyone holding the link can view the read-only setlist —
 * no login required — making this the target of links shared to the
 * read-only/public instance.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const setlist = await findSetlistByShareToken(token);
  if (!setlist) return { title: "Setlist" };
  return {
    title: setlist.title,
    openGraph: {
      title: setlist.title,
      images: ["/file.svg"],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: setlist.title,
      images: setlist.image ? [setlist.image] : ["/file.svg"],
    },
  };
}

export default async function SetlistSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { token } = await params;
  const { version: versionParam } = await searchParams;
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

  let sourceSetlist;
  try {
    sourceSetlist = versionParam
      ? await getSetlistVersion(sourceSetlistId, versionParam)
      : isReference
        ? await getSetlist(sourceSetlistId)
        : setlist;
  } catch {
    notFound();
  }

  const historyVersions = await listSetlistVersions(sourceSetlistId);

  const songDetails = await Promise.all(
    sourceSetlist.songs.filter(isSongItem).map(async (item) => {
      try {
        const meta = await getSong(item.songId);
        const translations = await getSongTranslations(item.songId);
        const { body } = await getSongTranslation(item.songId, item.lang);
        const originalLang = Object.keys(meta.titles ?? {})[0] || item.lang;
        return {
          ...item,
          title: await getSongTitle(item.songId, item.lang),
          key: meta.key,
          translations,
          body,
          spotify: meta.spotify?.song,
          youtube: meta.youtube,
          originalLang,
        };
      } catch {
        return {
          ...item,
          title: item.songId,
          key: undefined,
          translations: [] as string[],
          body: '',
          spotify: undefined,
          youtube: undefined,
          originalLang: item.lang,
        };
      }
    })
  );

  // Ordered entries: songs reference songDetails by position, notes/links pass through
  const linkPolicy = {
    allowedHosts: getSetlistLinkAllowedHosts(),
    allowHttp: getSetlistLinkAllowHttp(),
    ownHosts: (await headers()).get("host") ? [(await headers()).get("host")!.replace(/:\d+$/, "")] : [],
  };
  const noteRefTexts = new Map(
    await Promise.all(
      sourceSetlist.songs.filter(isRecurrentNoteItem).map(async (item) => [item.id, await renderNoteRefText(item.noteId, item.date)] as const)
    )
  );
  let songCursor = 0;
  const entries: SetlistReadOnlyEntry[] = sourceSetlist.songs.map((item) => {
    if (isNoteItem(item)) return { type: "note", id: item.id, text: item.text };
    if (isRecurrentNoteItem(item)) return { type: "note", id: item.id, text: noteRefTexts.get(item.id) ?? "" };
    if (isLinkItem(item)) {
      const check = validateLinkUrl(item.url, linkPolicy);
      return { type: "link", id: item.id, url: item.url, title: item.title, embeddable: check.ok, host: check.ok ? check.host : safeHost(item.url) };
    }
    return { type: "song", index: songCursor++ };
  });

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
    autoScrollSpeed?: number;
  };

  const userPrefs: UserPreferences = currentUser ? {
    showChords: currentUser.showChords ?? true,
    showRepeats: currentUser.showRepeats ?? true,
    chordNotation: (currentUser.chordNotation as "letters" | "solfege" | "roman" | "nashville") ?? 'letters',
    inlineChords: currentUser.inlineChords ?? false,
    setlistLyricsView: currentUser.setlistLyricsView ?? 'all',
    setlistTranspose: currentUser.setlistTranspose?.[sourceSetlistId] ?? {},
    autoScrollSpeed: currentUser.autoScrollSpeed,
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

      {setlist.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={setlist.image} alt={setlist.title} className="max-w-full h-auto rounded mb-4" />
      )}

      <SetlistReadOnlyView
        songs={songDetails}
        entries={entries}
        userPreferences={userPrefs}
        songBodies={songBodies}
        isReference={isReference}
        sourceSetlistId={sourceSetlistId}
        preferredVoice={currentUser?.voice}
        voiceShares={voiceShares}
        canGenerate={false}
      />

      <SetlistHistoryBrowser
        setlistId={setlist.id}
        historySetlistId={sourceSetlistId}
        canEdit={false}
        canManage={false}
        initialVersions={historyVersions}
        currentVersion={versionParam || null}
        shareToken={setlist.shareToken}
        versionHrefBase={`/setlists/share/${encodeURIComponent(token)}`}
      />
    </div>
  );
}