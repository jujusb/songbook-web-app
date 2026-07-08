import { redirect } from "next/navigation";
import { getSession, canEdit } from "@/lib/auth";
import { listSongs, getSongTranslations } from "@/lib/content";
import { SetlistEditor } from "@/components/SetlistEditor";

export default async function NewSetlistPage() {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");

  const songs = await listSongs();
  const songsWithLangs = await Promise.all(
    songs.map(async (s) => {
      const translations = await getSongTranslations(s.id);
      return { id: s.id, title: s.title, key: s.key, translations };
    })
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">New Setlist</h1>
      <SetlistEditor
        availableSongs={songsWithLangs}
        isNew={true}
      />
    </div>
  );
}
