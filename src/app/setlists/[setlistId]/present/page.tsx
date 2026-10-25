import { isSongItem } from "@/lib/content/schemas";
import { notFound } from "next/navigation";
import { getSetlist, getSong, getSongTranslation } from "@/lib/content";
import { getSession, canEdit, canViewSetlist } from "@/lib/auth";
import { PresentationView } from "@/components/PresentationView";

export default async function SetlistPresentPage({
  params,
  searchParams,
}: {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ display?: string; share?: string }>;
}) {
  const { setlistId } = await params;
  const { display, share } = await searchParams;
  const shareParam = typeof share === "string" ? share : undefined;

  let setlist;
  try {
    setlist = await getSetlist(setlistId);
  } catch {
    notFound();
  }

  const session = await getSession();
  if (!canViewSetlist(setlist, shareParam, canEdit(session?.role ?? null))) {
    notFound();
  }

  if (setlist.songs.length === 0) {
    notFound();
  }

  // Load all songs for the setlist
  const setlistSongs = await Promise.all(
    setlist.songs.filter(isSongItem).map(async (item) => {
      try {
        const meta = await getSong(item.songId);
        const { body } = await getSongTranslation(item.songId, item.lang);
        return {
          songId: item.songId,
          title: meta.title,
          source: body,
        };
      } catch {
        return null;
      }
    })
  );

  const validSongs = setlistSongs.filter(
    (s): s is { songId: string; title: string; source: string } => s !== null
  );

  if (validSongs.length === 0) {
    notFound();
  }

  return (
    <PresentationView
      songId={validSongs[0].songId}
      title={validSongs[0].title}
      source={validSongs[0].source}
      isAudience={display === "audience"}
      setlistSongs={validSongs}
      setlistTitle={setlist.title}
    />
  );
}
