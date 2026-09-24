import { notFound } from "next/navigation";
import { findSetlistByShareToken, getSong, getSongTranslation } from "@/lib/content";
import { PresentationView } from "@/components/PresentationView";

/**
 * Presentation view reached through a setlist share link. Resolves the setlist
 * by its share token or custom slug, so the presenter does not need to log in.
 */
export default async function SetlistSharePresentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ display?: string }>;
}) {
  const { token } = await params;
  const { display } = await searchParams;

  const setlist = await findSetlistByShareToken(token);
  if (!setlist || setlist.songs.length === 0) notFound();

  const setlistSongs = await Promise.all(
    setlist.songs.map(async (item) => {
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

  if (validSongs.length === 0) notFound();

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