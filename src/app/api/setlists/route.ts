import { NextResponse } from "next/server";
import { listSetlists, getSetlist, saveSetlist, deleteSetlist } from "@/lib/content";
import { getSession, canEdit, canAdmin } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import type { Setlist } from "@/lib/content/schemas";

export async function GET() {
  const all = await listSetlists();
  const session = await getSession();
  const showAll = canEdit(session?.role ?? null);
  return NextResponse.json(showAll ? all : all.filter((s) => s.public));
}

function readonlyResponse() {
  return NextResponse.json({ error: "Read-only mode" }, { status: 403 });
}

export async function POST(request: Request) {
  if (isReadOnly()) return readonlyResponse();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const id = (data.title as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const setlist: Setlist = {
      id,
      title: data.title,
      description: data.description || undefined,
      date: data.date || undefined,
      songs: data.songs || [],
      voiceShares: data.voiceShares || [],
      public: false,
      created: new Date().toISOString(),
    };

    await saveSetlist(setlist);
    return NextResponse.json(setlist, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create setlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (isReadOnly()) return readonlyResponse();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    if (!data.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Load existing to preserve created date
    let existing: Setlist | null = null;
    try {
      existing = await getSetlist(data.id);
    } catch {}

    const setlist: Setlist = {
      id: data.id,
      title: data.title,
      description: data.description || undefined,
      date: data.date || undefined,
      songs: data.songs || [],
      voiceShares: existing?.voiceShares ?? [],
      public: existing?.public ?? false,
      shareToken: existing?.shareToken,
      shareSlug: existing?.shareSlug,
      created: existing?.created || new Date().toISOString(),
    };

    await saveSetlist(setlist);
    return NextResponse.json(setlist);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update setlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (isReadOnly()) return readonlyResponse();
  const session = await getSession();
  if (!canAdmin(session?.role ?? null)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await deleteSetlist(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete setlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
