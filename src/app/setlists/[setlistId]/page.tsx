import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getSetlist, listSongs, getSong, getSongTranslation, getSongTranslations, getSongTitle, getLanguagesConfig, shouldShowSongInLanguage, getShareBaseUrl } from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, getCurrentUser, canEdit, canAdmin, canViewSetlist, canCreateSetlist, canManageSetlistShares } from "@/lib/auth";
import { SetlistEditor } from "@/components/SetlistEditor";
import { SetlistShareControls } from "@/components/SetlistShareControls";
import { SetlistReadOnlyView } from "@/components/SetlistReadOnlyView";
import { SetlistPdfButton } from "@/components/SetlistPdfButton";
import { DeleteButton } from "@/components/DeleteButton";
import { getSetlistVoiceShares } from "@/lib/navidrome/setlist-shares";

export default async function SetlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const { setlistId } = await params;
  const { share } = await searchParams;
  const shareParam = typeof share === "string" ? share : undefined;

  let setlist;
  try {
    setlist = await getSetlist(setlistId);
  } catch {
    notFound();
  }

  const session = await getSession();
  const userId = session?.userId;
  const role = session?.role ?? null;
  const currentUser = await getCurrentUser();
  const showEditActions = canEdit(role);
  const showDeleteActions = canAdmin(role);
  const canCreate = canCreateSetlist(role);
  const canManageShares = canManageSetlistShares(role);
  const isOwner = setlist.ownerId === userId;
  const isSubscriber = userId ? (setlist.subscribers ?? []).includes(userId) : false;
  const showEditor = showEditActions || (canCreate && isOwner);
  const showShareControls = showEditActions || (canManageShares && isOwner);
  const showVoiceShares = showEditActions || (canCreate && isOwner);

  if (!canViewSetlist(setlist, shareParam, showEditor, isSubscriber)) {
    notFound();
  }

  // Determine source setlist (original for references)
  const isReference = !!setlist.sharedFrom;
  const sourceSetlistId = isReference ? setlist.sharedFrom!.setlistId : setlistId;
  const sourceSetlist = isReference ? await getSetlist(sourceSetlistId) : setlist;

  const voiceShares = await getSetlistVoiceShares(sourceSetlist, session?.role ?? 'public');
  const presentHref = `/setlists/${setlistId}/present${
    shareParam ? `?share=${shareParam}` : ""
  }`;

  const langConfig = await getLanguagesConfig();
  const selectedLang = getLocale(await cookies(), langConfig.default);
  const publicUrl = await getShareBaseUrl();

  type UserPreferences = {
  showChords: boolean;
  showRepeats: boolean;
  chordNotation: "letters" | "solfege" | "roman" | "nashville";
  inlineChords: boolean;
  setlistLyricsView: "all" | "list";
  setlistTranspose: Record<string, number>;
};

// User preferences for lyrics view
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

  // Load available songs for editor
  const songs = await listSongs();
  const songsWithLangs = await Promise.all(
    songs.map(async (s) => {
      const translations = await getSongTranslations(s.id);
      return { id: s.id, title: s.title, key: s.key, translations };
    })
  );

  // Resolve song titles for display + load song bodies for lyrics view
  const songDetails = await Promise.all(
    sourceSetlist.songs.map(async (item) => {
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

  const visibleSongDetails = songDetails.filter((song) => {
    if (!shouldShowSongInLanguage(song.translations, selectedLang, langConfig.default)) {
      return false;
    }
    // Filter by published status for non-admin users
    if (!showEditor && !song.published) {
      return false;
    }
    return true;
  });
  const displayCount = showEditor ? sourceSetlist.songs.length : visibleSongDetails.length;

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
              {displayCount} song{displayCount !== 1 ? "s" : ""}
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
              Present
            </Link>
          )}
          {setlist.songs.length > 0 && (
            <SetlistPdfButton
              setlistId={setlist.id}
              shareToken={setlist.shareToken}
            />
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

      {showShareControls && (
        <SetlistShareControls
          setlistId={setlist.id}
          isPublic={setlist.public ?? false}
          shareToken={setlist.shareToken}
          shareSlug={setlist.shareSlug}
          publicUrl={publicUrl}
        />
      )}

      {showEditor ? (
        <SetlistEditor
          availableSongs={songsWithLangs}
          initialSetlist={{
            id: setlist.id,
            title: setlist.title,
            description: setlist.description || "",
            date: setlist.date || "",
            songs: setlist.songs,
          }}
          isNew={false}
        />
      ) : (
        <SetlistReadOnlyView
          songs={songDetails}
          userPreferences={userPrefs}
          songBodies={songBodies}
          isReference={isReference}
          sourceSetlistId={sourceSetlistId}
          preferredVoice={currentUser?.voice}
          voiceShares={voiceShares}
          canGenerate={showVoiceShares}
        />
      )}
    </div>
  );
}