import { NextResponse } from "next/server";
import { getSession, canEdit, canEditSong, getCurrentUser } from "@/lib/auth";
import { isReadOnlyFor } from "@/lib/readonly";
import { listRevisions, getRevision, findSongPath } from "@/lib/content";
import { saveRevision as saveRevisionLib } from "@/lib/content/revisions";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isReadOnlyFor('song_write')) {
    return NextResponse.json({ error: "Read-only mode" }, { status: 403 });
  }
  
  const { id } = await params;
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

    const revisions = await listRevisions(songPath, lang);
    return NextResponse.json({ revisions, songId: id, lang });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list revisions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}