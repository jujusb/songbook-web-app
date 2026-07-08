import Link from "next/link";
import { listSongs } from "@/lib/content";
import { SongListFilter } from "@/components/SongListFilter";

export default async function SongsPage() {
  const songs = await listSongs();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Songs</h1>
      <SongListFilter songs={songs} />
    </div>
  );
}
