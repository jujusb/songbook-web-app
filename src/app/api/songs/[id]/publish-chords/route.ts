import { NextResponse } from "next/server";
import { getSession, canEdit, canEditSong, getCurrentUser } from "@/lib/auth";
import { isReadOnlyFor } from "@/lib/readonly";
import { findSongPath, saveSongTranslation, saveRevision, getSongTranslation } from "@/lib/content";

export async function POST(
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

    // Get current translation to preserve body and other fields
    const { meta, body } = await getSongTranslation(id, lang);

    // Update chordsPublished status
    const updatedMeta = {
      ...meta,
      chordsPublished: true,
      chordsPublishedRevision: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      modifiedBy: user?.username || session?.userId || 'unknown',
    };

    // Save revision before updating
    await saveRevision(id, lang, songPath + `/${lang}.cho`);

    // Save updated translation
    await saveSongTranslation(id, lang, updatedMeta, body);

    return NextResponse.json({ 
      success: true, 
      songId: id, 
      lang,
      chordsPublished: true,
      publishedAt: updatedMeta.chordsPublishedRevision
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to publish chords";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
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

    // Get current translation
    const { meta, body } = await getSongTranslation(id, lang);

    // Unpublish chords
    const updatedMeta = {
      ...meta,
      chordsPublished: false,
      chordsPublishedRevision: undefined,
      lastModified: new Date().toISOString(),
      modifiedBy: user?.username || session?.userId || 'unknown',
    };

    // Save revision before updating
    await saveRevision(id, lang, songPath + `/${lang}.cho`);

    // Save updated translation
    await saveSongTranslation(id, lang, updatedMeta, body);

    return NextResponse.json({ 
      success: true, 
      songId: id, 
      lang,
      chordsPublished: false
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to unpublish chords";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}