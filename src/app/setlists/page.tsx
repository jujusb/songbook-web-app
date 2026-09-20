import Link from "next/link";
import { listSetlists, listSongs } from "@/lib/content";
import { getSession, canEdit } from "@/lib/auth";
import { T } from "@/components/Translate";

export default async function SetlistsPage() {
  const setlists = await listSetlists();
  const songs = await listSongs();
  const songMap = new Map(songs.map((s) => [s.id, s]));
  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold"><T k="setlist.title" /></h1>
        {showEditActions && (
          <Link
            href="/setlists/new"
            className="text-sm px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            <T k="setlist.newSetlist" />
          </Link>
        )}
      </div>

      {setlists.length === 0 ? (
        <p className="text-neutral-500"><T k="setlist.noSetlists" /></p>
      ) : (
        <div className="space-y-3">
          {setlists.map((setlist) => (
            <Link
              key={setlist.id}
              href={`/setlists/${setlist.id}`}
              className="block p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{setlist.title}</h2>
                  {setlist.description && (
                    <p className="text-sm text-neutral-500 mt-0.5">
                      {setlist.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-400 shrink-0 ml-4">
                  {setlist.date && <span>{setlist.date}</span>}
                  <span>
                    {setlist.songs.length} song
                    {setlist.songs.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              {setlist.songs.length > 0 && (
                <div className="mt-2 text-xs text-neutral-400">
                  {setlist.songs
                    .slice(0, 5)
                    .map((s) => {
                      const song = songMap.get(s.songId);
                      if (!song) return s.songId;
                      return song.titles?.[s.lang] || song.title;
                    })
                    .join(" \u2022 ")}
                  {setlist.songs.length > 5 && ` \u2026 +${setlist.songs.length - 5} more`}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
