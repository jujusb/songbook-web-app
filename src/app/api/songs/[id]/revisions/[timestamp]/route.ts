import { NextResponse } from "next/server";
import { getSession, canEdit, canEditSong, getCurrentUser } from "@/lib/auth";
import { isReadOnlyFor } from "@/lib/readonly";
import { getRevision, findSongPath } from "@/lib/content";

export async function GET(
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

    // Convert timestamp back to filename format
    const file = timestamp.replace(/[-T:]/g, '-').replace(/--/g, '-') + '.cho';
    const content = await getRevision(songPath, lang, file);
    return NextResponse.json({ content, timestamp, songId: id, lang });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get revision";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}