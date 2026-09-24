import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getSetlist, listSongs, getSong, getSongTranslations, getSongTitle, getLanguagesConfig, shouldShowSongInLanguage } from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { languageLabelFor } from "@/lib/i18n/labels";
import { getSession, canEdit, canAdmin } from "@/lib/auth";
import { SetlistEditor } from "@/components/SetlistEditor";
import { SetlistVoiceLinks } from "@/components/SetlistVoiceLinks";
import { DeleteButton } from "@/components/DeleteButton";

export default async function SetlistPage({
  params,
}: {
  params: Promise<{ setlistId: string }>;
}) {
  const { setlistId } = await params;

  let setlist;
  try {
    setlist = await getSetlist(setlistId);
  } catch {
    notFound();
  }

  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);
  const showDeleteActions = canAdmin(session?.role ?? null);

  const langConfig = await getLanguagesConfig();
  const selectedLang = getLocale(await cookies(), langConfig.default);
  const langLabel = languageLabelFor;

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
        return { ...item, title: await getSongTitle(item.songId, item.lang), key: meta.key, translations };
      } catch {
        return { ...item, title: item.songId, key: undefined, translations: [] as string[] };
      }
    })
  );

  const visibleSongDetails = songDetails.filter((song) =>
    shouldShowSongInLanguage(song.translations, selectedLang, langConfig.default)
  );
  const displayCount = showEditActions ? setlist.songs.length : visibleSongDetails.length;

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
              href={`/setlists/${setlistId}/present`}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Present
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

      {showEditActions ? (
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
        /* Read-only song list */
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Song Order
            </span>
          </div>
          <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {visibleSongDetails.map((song, index) => (
              <li key={`${song.songId}-${index}`}>
                <div className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                  <span className="text-sm text-neutral-400 w-8 text-right font-mono">
                    {index + 1}
                  </span>
                  <Link
                    href={`/songs/${song.songId}`}
                    className="flex-1 font-medium hover:underline"
                  >
                    {song.title}
                  </Link>
                  {song.key && (
                    <span className="text-xs text-neutral-400">{song.key}</span>
                  )}
                  <span className="text-xs px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-500">
                    {langLabel(song.lang)}
                  </span>
                  <SetlistVoiceLinks songId={song.songId} lang={song.lang} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
