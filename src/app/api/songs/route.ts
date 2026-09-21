import { NextResponse } from "next/server";
import { listSongs, createSong, saveSongTranslation, getAlbum, saveAlbum, deleteSong } from "@/lib/content";

export async function GET() {
  try {
    const songs = await listSongs();
    return NextResponse.json(songs);
  } catch {
    return NextResponse.json(
      { error: "Failed to list songs" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, title, lang, chordpro, albumId } = body;

    if (!id || !title) {
      return NextResponse.json(
        { error: "id and title are required" },
        { status: 400 }
      );
    }
    if (!albumId) {
      return NextResponse.json(
        { error: "albumId is required" },
        { status: 400 }
      );
    }

    const language = lang || "en";

    // Create the song folder inside the album: content/library/<albumId>/<songId>/
    await createSong(id, title, language, albumId);

    // If chordpro content was provided (from import), overwrite the default .cho file
    if (chordpro && typeof chordpro === "string" && chordpro.trim()) {
      await saveSongTranslation(
        id,
        language,
        { language, translator: null, status: "draft", published: false },
        chordpro.trim(),
        albumId
      );
    }

    // Add song to album.yaml's songs order list
    try {
      const album = await getAlbum(albumId);
      if (!album.songs.includes(id)) {
        album.songs.push(id);
        await saveAlbum(album);
      }
    } catch {
      // Album not found — song folder was still created
    }

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create song" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteSong(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete song" },
      { status: 500 }
    );
  }
}
