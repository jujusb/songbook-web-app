import { headers, cookies } from "next/headers";
import { getLocale, createT, plural } from "@/lib/i18n/server";
import { validateLinkUrl, safeHost } from "@/lib/setlist-links";
import { getSetlistLinkAllowedHosts, getSetlistLinkAllowHttp, getSetlistDefaultMode, getSetlistModesAllowed } from "@/lib/config";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getSetlist, getSong, getSongTranslation, getSongTranslations, getSongTitle, listSetlistVersions, getSetlistVersion, parseSetlistVersionDate } from "@/lib/content";
import { getSession, getCurrentUser, canEdit, canAdmin, canViewSetlist, canCreateSetlist, canViewSetlistStats } from "@/lib/auth";
import { isSongItem, isNoteItem, isLinkItem, isRecurrentNoteItem } from "@/lib/content/schemas";
import { renderNoteRefText } from "@/lib/note-render";
import { SetlistReadOnlyView, type SetlistReadOnlyEntry } from "@/components/SetlistReadOnlyView";
import { SetlistHistoryBrowser } from "@/components/SetlistHistoryBrowser";
import { SetlistPdfButton } from "@/components/SetlistPdfButton";
import SetlistModeSelector from "@/components/SetlistModeSelector";
import { DeleteButton } from "@/components/DeleteButton";
import { getSetlistVoiceShares } from "@/lib/navidrome/setlist-shares";
import { normalizeSetlistMode } from "@/lib/setlist-modes";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ version?: string }>;
}): Promise<Metadata> {
  const { setlistId } = await params;
  const { version } = await searchParams;
  const t = createT(getLocale(await cookies()));
  try {
    const setlist = await getSetlist(setlistId);
    const base = setlist.title;
    if (version && version !== "current") {
      const dated = await getSetlistVersion(setlist.sharedFrom?.setlistId ?? setlistId, version).catch(() => null);
      const date = dated?.date || parseSetlistVersionDate(version);
      return { title: date ? `${base} - ${date}` : base };
    }
    return { title: setlist.date ? `${base} - ${setlist.date}` : base };
  } catch {
    return { title: t("setlistApp.setlistFallbackTitle") };
  }
}

export default async function SetlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ share?: string; mode?: string; version?: string }>;
}) {
  const { setlistId } = await params;
  const { share, mode, version: versionParam } = await searchParams;
  const shareParam = typeof share === "string" ? share : undefined;
  const t = createT(getLocale(await cookies()));

  let baseSetlist;
  try {
    baseSetlist = await getSetlist(setlistId);
  } catch {
    notFound();
  }

  // Saved/shared setlists keep their own id, but their history lives on the
  // original setlist. Resolve it before loading a selected version.
  const isReference = !!baseSetlist.sharedFrom;
  const sourceSetlistId = isReference ? baseSetlist.sharedFrom!.setlistId : setlistId;

  let setlist;
  try {
    setlist = versionParam && versionParam !== 'current'
      ? await getSetlistVersion(sourceSetlistId, versionParam)
      : baseSetlist;
  } catch {
    notFound();
  }

  const currentMode = normalizeSetlistMode(
    typeof mode === "string" ? mode : setlist.mode || getSetlistDefaultMode()
  );

  const session = await getSession();
  const userId = session?.userId;
  const role = session?.role ?? null;
  const currentUser = await getCurrentUser();
  const showEditActions = canEdit(role);
  const showDeleteActions = canAdmin(role);
  const canCreate = canCreateSetlist(role);
  const isOwner = baseSetlist.ownerId === userId;
  const isSubscriber = userId ? (baseSetlist.subscribers ?? []).includes(userId) : false;
  const showVoiceShares = showEditActions || (canCreate && isOwner);
  // Show editor for admins/reviewers
  const showEditor = showEditActions;
  // Owners (and editors) get an Edit button; references are read-only for subscribers
  const canEditSetlist = !isReference && (showEditActions || (canCreate && isOwner));

  if (!canViewSetlist(baseSetlist, shareParam, showEditor, isSubscriber)) {
    notFound();
  }

  const sourceSetlist = versionParam
    ? setlist
    : isReference
      ? await getSetlist(sourceSetlistId)
      : setlist;

  const voiceShares = await getSetlistVoiceShares(sourceSetlist, session?.role ?? 'public');
  const historyVersions = await listSetlistVersions(sourceSetlistId);
  // The current setlist's own date (not the viewed version's).
  const currentSetlistDate = (await getSetlist(sourceSetlistId).catch(() => null))?.date ?? "";
  const currentVersion = versionParam || null;
  const presentHref = `/setlists/${setlistId}/present${
    shareParam ? `?share=${shareParam}` : ""
  }`;

  type UserPreferences = {
  showChords: boolean;
  showRepeats: boolean;
  chordNotation: "letters" | "solfege" | "roman" | "nashville";
  inlineChords: boolean;
  setlistLyricsView: "all" | "list";
  setlistTranspose: Record<string, number>;
  autoScrollSpeed?: number;
};

// User preferences for lyrics view
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

  // Resolve song titles for display + load song bodies for lyrics view
  const songDetails = await Promise.all(
    sourceSetlist.songs.filter(isSongItem).map(async (item) => {
      try {
        const meta = await getSong(item.songId);
        const translations = await getSongTranslations(item.songId);
        // Check published status for the selected language
        const { meta: translationMeta, body } = await getSongTranslation(item.songId, item.lang);
        const originalLang = Object.keys(meta.titles ?? {})[0] || item.lang;
        return { 
          ...item, 
          title: await getSongTitle(item.songId, item.lang), 
          key: meta.key, 
          translations,
          published: translationMeta.published,
          chordsPublished: translationMeta.chordsPublished === true,
          body,
          spotify: meta.spotify?.song,
          youtube: meta.youtube,
          originalLang,
        };
      } catch {
        return { ...item, title: item.songId, key: undefined, translations: [] as string[], published: false, body: '', spotify: undefined, youtube: undefined, originalLang: item.lang };
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

  // Ordered entries: songs reference songDetails by position, notes/links pass through
  const linkPolicy = {
    allowedHosts: getSetlistLinkAllowedHosts(),
    allowHttp: getSetlistLinkAllowHttp(),
    ownHosts: (await headers()).get("host") ? [(await headers()).get("host")!.replace(/:\d+$/, "")] : [],
  };
  const noteRefTexts = new Map(
    await Promise.all(
      sourceSetlist.songs.filter(isRecurrentNoteItem).map(async (item) => [item.id, await renderNoteRefText(item.noteId, item.date, item.lang)] as const)
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

  // Non-editors only see published songs
  const visibleSongDetails = songDetails.filter((song) => showEditor || song.published);
  const displayCount = visibleSongDetails.length;

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/setlists"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
      >
        &larr; {t("setlistApp.allSetlists")}
      </Link>

      <SetlistHistoryBrowser
        setlistId={setlistId}
        historySetlistId={sourceSetlistId}
        canEdit={showEditActions}
        initialVersions={historyVersions}
        currentVersion={currentVersion}
        currentDate={currentSetlistDate}
        versionHrefBase={`/setlists/${setlistId}`}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          {setlist.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={setlist.image} alt={setlist.title} className="mb-3 max-h-48 rounded-md" />
          )}
          <h1 className="text-2xl font-bold">{setlist.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500">
            {setlist.date && <span>{setlist.date}</span>}
            <span>
              {plural(t("setlist.count", { n: displayCount }), displayCount)}
            </span>
          </div>
          {setlist.description && (
            <p className="text-neutral-500 mt-1 text-sm">{setlist.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {setlist.songs.length > 0 && (
            <Link
              href={presentHref}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {t("setlist.present")}
            </Link>
          )}
          {canViewSetlistStats(role) && (
            <Link
              href={`/setlists/${encodeURIComponent(sourceSetlistId)}/stats`}
              className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {t("nav.statistics")}
            </Link>
          )}
          {setlist.songs.length > 0 && (
            <SetlistPdfButton
              setlistId={setlist.id}
              shareToken={setlist.shareToken}
            />
          )}
           {canEditSetlist && (
             <Link
               href={`/setlists/${setlistId}/edit${versionParam ? `?version=${encodeURIComponent(versionParam)}` : ""}`}
               className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
             >
               {t("common.edit")}
             </Link>
           )}
          {showDeleteActions && (
            <DeleteButton
              apiEndpoint="/api/setlists"
              id={setlistId}
              label={setlist.title}
              redirectTo="/setlists"
            />
          )}
        </div>
      </div>

      <SetlistModeSelector setlistId={setlistId} currentMode={currentMode} allowedModes={getSetlistModesAllowed()} />

      <SetlistReadOnlyView
        key={currentMode}
        songs={songDetails}
        entries={entries}
        userPreferences={userPrefs}
        songBodies={songBodies}
        isReference={isReference}
        sourceSetlistId={sourceSetlistId}
        preferredVoice={currentUser?.voice}
        voiceShares={voiceShares}
        canGenerate={showVoiceShares}
        mode={currentMode}
      />

    </div>
  );
}