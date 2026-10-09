import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getSetlist, listSongs, getSong, getSongTranslation, getSongTranslations, getSongTitle, getLanguagesConfig, shouldShowSongInLanguage, getShareBaseUrl } from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, getCurrentUser, canEdit, canAdmin, canViewSetlist, canCreateSetlist, canManageSetlistShares } from "@/lib/auth";
import { SetlistEditor } from "@/components/SetlistEditor";
import { SetlistVoicePlaylists } from "@/components/SetlistVoicePlaylists";
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
  const currentVoice = (await getCurrentUser())?.voice;
  const showEditActions = canEdit(role);
  const showDeleteActions = canAdmin(role);
  const canCreate = canCreateSetlist(role);
  const canManageShares = canManageSetlistShares(role);
  const isOwner = setlist.ownerId === userId;
  const showEditor = showEditActions || (canCreate && isOwner);
  const showShareControls = showEditActions || (canManageShares && isOwner);
  const showVoiceShares = showEditActions || (canCreate && isOwner);

  if (!canViewSetlist(setlist, shareParam, showEditor)) {
    notFound();
  }

  const voiceShares = await getSetlistVoiceShares(setlist, session?.role ?? 'public');
  const presentHref = `/setlists/${setlistId}/present${
    shareParam ? `?share=${shareParam}` : ""
  }`;

  const langConfig = await getLanguagesConfig();
  const selectedLang = getLocale(await cookies(), langConfig.default);
  const publicUrl = await getShareBaseUrl();

  // Load available songs for editor
  const songs = await listSongs();
  const songsWithLangs = await Promise.all(
    songs.map(async (s) => {
      const translations = await getSongTranslations(s.id);
      return { id: s.id, title: s.title, key: s.key, translations };
    })
  );

  // Resolve song titles for display
  const songDetails = await Promise.all(
    setlist.songs.map(async (item) => {
      try {
        const meta = await getSong(item.songId);
        const translations = await getSongTranslations(item.songId);
        // Check published status for the selected language
        const { meta: translationMeta } = await getSongTranslation(item.songId, item.lang);
        return { 
          ...item, 
          title: await getSongTitle(item.songId, item.lang), 
          key: meta.key, 
          translations,
          published: translationMeta.published
        };
      } catch {
        return { ...item, title: item.songId, key: undefined, translations: [] as string[], published: false };
      }
    })
  );

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
  const displayCount = showEditor ? setlist.songs.length : visibleSongDetails.length;

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

      <SetlistVoicePlaylists
        setlistId={setlist.id}
        shares={voiceShares}
        canGenerate={showVoiceShares}
        preferredVoice={currentVoice}
      />

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
          selectedLang={selectedLang}
          defaultLang={langConfig.default}
        />
      )}
    </div>
  );
}
