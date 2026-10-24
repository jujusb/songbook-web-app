import { notFound, redirect } from "next/navigation";
import { getSetlist, listSongs, getSongTranslations } from "@/lib/content";
import { getSession, canEdit, canViewSetlist } from "@/lib/auth";
import { SetlistEditor } from "@/components/SetlistEditor";

export default async function SetlistEditPage({
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
  const userId = session?.userId;
  const role = session?.role ?? null;
  const showEditActions = canEdit(role);
  const isOwner = setlist.ownerId === userId;
  const isSubscriber = userId ? (setlist.subscribers ?? []).includes(userId) : false;
  const showEditor = showEditActions || isOwner;

  if (!canViewSetlist(setlist, undefined, showEditor, isSubscriber)) {
    notFound();
  }

  if (!isOwner && !showEditActions) {
    redirect(`/setlists/${setlistId}`);
  }

  const songs = await listSongs();
  const songsWithLangs = await Promise.all(
    songs.map(async (s) => {
      const translations = await getSongTranslations(s.id);
      return { id: s.id, title: s.title, key: s.key, translations };
    })
  );

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <a
          href={`/setlists/${setlistId}`}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-block mb-4"
        >
          &larr; Back to Setlist
        </a>
        <h1 className="text-2xl font-bold">Edit: {setlist.title}</h1>
      </div>

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
    </div>
  );
}