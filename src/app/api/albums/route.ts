import { NextResponse } from "next/server";
import { listAlbums, saveAlbum, deleteAlbum, moveNoAlbumSongsIntoAlbum } from "@/lib/content";
import { AlbumSchema } from "@/lib/content/schemas";
import { isReadOnly, isReadOnlyFor } from "@/lib/readonly";
import { getSession, canAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";
    
    let options = {};
    if (all) {
      const session = await getSession();
      if (!canAdmin(session?.role ?? null)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      options = { onlyPublished: false, role: 'admin' };
    }
    
    const albums = await listAlbums(options);
    return NextResponse.json(albums);
  } catch {
    return NextResponse.json(
      { error: "Failed to list albums" },
      { status: 500 }
    );
  }
}

function readonlyResponse() {
  return NextResponse.json({ error: "Read-only mode" }, { status: 403 });
}

export async function POST(request: Request) {
  if (isReadOnly()) return readonlyResponse();
  try {
    const body = await request.json();
    const album = AlbumSchema.parse(body);
    await saveAlbum(album);
    await moveNoAlbumSongsIntoAlbum(album.id, album.songs);
    return NextResponse.json({ success: true, id: album.id }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create album" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  if (isReadOnly()) return readonlyResponse();
  try {
    const body = await request.json();
    const album = AlbumSchema.parse(body);
    await saveAlbum(album);
    await moveNoAlbumSongsIntoAlbum(album.id, album.songs);
    return NextResponse.json({ success: true, id: album.id });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update album" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  if (isReadOnly()) return readonlyResponse();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteAlbum(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete album" },
      { status: 500 }
    );
  }
}
