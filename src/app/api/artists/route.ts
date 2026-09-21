import { NextResponse } from "next/server";
import { listArtists, saveArtist, deleteArtist } from "@/lib/content";
import { ArtistSchema } from "@/lib/content/schemas";

export async function GET() {
  try {
    const artists = await listArtists();
    return NextResponse.json(artists);
  } catch {
    return NextResponse.json(
      { error: "Failed to list artists" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const artist = ArtistSchema.parse(body);
    await saveArtist(artist);
    return NextResponse.json({ success: true, id: artist.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create artist" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const artist = ArtistSchema.parse(body);
    await saveArtist(artist);
    return NextResponse.json({ success: true, id: artist.id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update artist" },
      { status: 400 }
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
    await deleteArtist(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete artist" },
      { status: 500 }
    );
  }
}
