import { getSetlistLinkAllowedHosts, getSetlistLinkAllowHttp } from "@/lib/config";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSetlist, listSongs, getSongTranslations, getShareBaseUrl } from "@/lib/content";
import { getSession, canEdit, canCreateSetlist, canManageSetlistShares } from "@/lib/auth";
import { SetlistEditor } from "@/components/SetlistEditor";
import { SetlistShareControls } from "@/components/SetlistShareControls";

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
  if (!session) redirect("/login");

  const role = session.role ?? null;
  const isEditor = canEdit(role);
  const isOwner = setlist.ownerId === session.userId;

  // Only owners (with setlist rights) and editors may edit; references are read-only.
  const mayEdit = !setlist.sharedFrom && (isEditor || (isOwner && canCreateSetlist(role)));
  if (!mayEdit) {
    redirect(`/setlists/${setlistId}`);
  }

  const showShareControls = isEditor || (isOwner && canManageSetlistShares(role));
  const publicUrl = await getShareBaseUrl();

  const songs = await listSongs();
  const songsWithLangs = await Promise.all(
    songs.map(async (s) => {
      const translations = await getSongTranslations(s.id);
      return { id: s.id, title: s.title, key: s.key, translations };
    })
  );

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={`/setlists/${setlistId}`}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
      >
        &larr; {setlist.title}
      </Link>
      <h1 className="text-2xl font-bold mb-6">Edit: {setlist.title}</h1>

      {showShareControls && (
        <SetlistShareControls
          setlistId={setlist.id}
          isPublic={setlist.public ?? false}
          shareToken={setlist.shareToken}
          shareSlug={setlist.shareSlug}
          publicUrl={publicUrl}
        />
      )}

      <SetlistEditor
        allowedLinkHosts={getSetlistLinkAllowedHosts()}
        allowHttpLinks={getSetlistLinkAllowHttp()}
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
