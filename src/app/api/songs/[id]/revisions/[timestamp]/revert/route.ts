import { NextResponse } from "next/server";
import { getSession, canEdit, canEditSong, getCurrentUser } from "@/lib/auth";
import { isReadOnlyFor } from "@/lib/readonly";
import { findSongPath, saveSongTranslation, getSongTranslation } from "@/lib/content";
import { getRevision, listRevisions, saveRevision as saveRevisionLib } from "@/lib/content/revisions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; timestamp: string }> }
) {
  if (isReadOnlyFor('song_write')) {
    return NextResponse.json({ error: "Read-only mode" }, { status: 403 });
  }
  
  const { id, timestamp } = await params;
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") || "en";

  const session = await getSession();
  const user = await getCurrentUser();
  if (!canEdit(session?.role ?? null) && !canEditSong(user, id, lang)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const songPath = await findSongPath(id);
    if (!songPath) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Convert timestamp to filename (ISO with colons replaced by dashes)
    const file = timestamp.replace(/:/g, '-').replace(/\./g, '-') + '.cho';
    
    // Get the revision content
    const revisionContent = await getRevision(songPath, lang, file);
    
    // Parse the revision content (might have frontmatter)
    const { meta: currentMeta } = await getSongTranslation(id, lang);
    const matter = await import("gray-matter");
    const parsed = matter.default(revisionContent);
    const parsedData = parsed.data as { language?: string; status?: 'draft' | 'review' | 'final'; published?: boolean; title?: string; translator?: string | null; lastModified?: string; modifiedBy?: string };
    const frontmatter = parsedData.language 
      ? { language: parsedData.language, status: parsedData.status || 'draft', published: parsedData.published || false, title: parsedData.title, translator: parsedData.translator, lastModified: parsedData.lastModified, modifiedBy: parsedData.modifiedBy }
      : currentMeta;
    const body = parsed.content.trim();

    // Save current version as revision first
    await saveRevisionLib(songPath, lang);
    
    // Apply the revision as current
    await saveSongTranslation(id, lang, frontmatter, body);

    return NextResponse.json({ success: true, timestamp, message: "Reverted to revision" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to revert";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}