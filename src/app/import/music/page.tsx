import { getSession, canEdit } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { isReadOnly } from "@/lib/readonly";
import { MusicImportClient } from "@/components/MusicImportClient";

export default async function MusicImportPage() {
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Import Music</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Scan your music directory for audio files and link them to songs.
        Set <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">MUSIC_DIR</code> env var to point to your music folder.
      </p>
      <MusicImportClient />
    </div>
  );
}
