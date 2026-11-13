import type { Metadata } from "next";
import { isSongItem } from "@/lib/content/schemas";
import Link from "next/link";
import { cookies } from "next/headers";
import { listSetlists, listSongs, getLanguagesConfig, resolveSongListTitle } from "@/lib/content";
import { getLocale, createT, plural } from "@/lib/i18n/server";
import { getSession, canEdit, canCreateSetlist, canViewSetlistStats, getCurrentUser } from "@/lib/auth";
import { T } from "@/components/Translate";

export default async function SetlistsPage() {
  const session = await getSession();
  const currentUser = await getCurrentUser();
  const showEditActions = canEdit(session?.role ?? null);
  const userId = currentUser?.id;

  const [setlists, songs, langConfig] = await Promise.all([
    listSetlists({ userId }),
    listSongs({ onlyPublished: true, role: session?.role ?? 'public' }),
    getLanguagesConfig(),
  ]);
  const songMap = new Map(songs.map((s) => [s.id, s]));
  const selectedLang = getLocale(await cookies(), langConfig.default);
  const t = createT(selectedLang);

  // Private setlists (the default) are only visible to editors.
  const visibleSetlists = showEditActions
    ? setlists
    : setlists.filter((s) => s.public);

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold"><T k="setlist.title" /></h1>
        <div className="flex items-center gap-2">
          {canViewSetlistStats(session?.role ?? null) && (
            <Link
              href="/setlists/stats"
              className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <T k="nav.statistics" />
            </Link>
          )}
          {canCreateSetlist(session?.role ?? null) && (
            <Link
              href="/setlists/new"
              className="text-sm px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              <T k="setlist.newSetlist" />
            </Link>
          )}
        </div>
      </div>

      {visibleSetlists.length === 0 ? (
        <p className="text-neutral-500"><T k="setlist.noSetlists" /></p>
      ) : (
        <div className="space-y-3">
          {visibleSetlists.map((setlist) => {
            const isReference = !!setlist.sharedFrom;
            const visibleSongs = setlist.songs.filter(isSongItem).filter((s) => {
              if (selectedLang === langConfig.default) return true;
              const song = songMap.get(s.songId);
              if (!song) return false;
              if (!song.translations.includes(selectedLang)) return false;
              // Filter by published status for non-admin
              if (!showEditActions && song.published && song.published[selectedLang] === false) {
                return false;
              }
              return true;
            });
            return (
              <Link
                key={setlist.id}
                href={`/setlists/${setlist.id}`}
                className="block p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{setlist.title}</h2>
                      {isReference && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          <T k="setlist.savedFromShared" />
                        </span>
                      )}
                    </div>
                    {setlist.description && (
                      <p className="text-sm text-neutral-500 mt-0.5">
                        {setlist.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-400 shrink-0 ml-4">
                    {showEditActions && (
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          setlist.public
                            ? "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                        }`}
                      >
                        {setlist.public ? (
                          <T k="setlist.publicBadge" />
                        ) : (
                          <T k="setlist.privateBadge" />
                        )}
                      </span>
                    )}
                    {setlist.date && <span>{setlist.date}</span>}
                    <span>
                      {plural(t("setlist.count", { n: visibleSongs.length }), visibleSongs.length)}
                    </span>
                  </div>
                </div>
                {visibleSongs.length > 0 && (
                  <div className="mt-2 text-xs text-neutral-400">
                    {visibleSongs
                      .slice(0, 5)
                      .map((s) => {
                        const song = songMap.get(s.songId);
                        if (!song) return s.songId;
                        return resolveSongListTitle(song, s.lang);
                      })
                      .join(" \u2022 ")}
                    {visibleSongs.length > 5 && t("setlist.more", { n: visibleSongs.length - 5 })}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
export async function generateMetadata(): Promise<Metadata> {
  const t = createT(getLocale(await cookies()));
  return { title: t("nav.setlists") };
}
