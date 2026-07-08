import Link from "next/link";
import { listSongs } from "@/lib/content";
import { SongListFilter } from "@/components/SongListFilter";

export default async function SongsPage() {
  const songs = await listSongs();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Songs</h1>
        <Link
          href="/print"
          className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Print Songbook
        </Link>
      </div>
      <SongListFilter songs={songs} />
    </div>
  );
}
