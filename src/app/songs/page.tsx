import Link from "next/link";
import { listSongs, getLanguagesConfig, listAlbums, listArtists } from "@/lib/content";
import { SongListFilter } from "@/components/SongListFilter";
import { T } from "@/components/Translate";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";

export default async function SongsPage() {
  const [songs, langConfig, albums, artists] = await Promise.all([listSongs(), getLanguagesConfig(), listAlbums(), listArtists()]);
  const session = await getSession();
  const showBulkImport = !isReadOnly() && canEdit(session?.role ?? null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold"><T k="nav.songs" /></h1>
        <div className="flex items-center gap-2">
          {showBulkImport && (
            <Link
              href="/import"
              className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <T k="bulkImport.heading" />
            </Link>
          )}
          <Link
            href="/pdf"
            className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <T k="print.printSongbook" />
          </Link>
        </div>
      </div>
      <SongListFilter songs={songs} defaultLang={langConfig.default} albums={albums} artists={artists} />
    </div>
  );
}
