import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import * as yaml from "js-yaml";
import { listSetlists, getSetlist, getSetlistVersion, saveSetlist, deleteSetlist } from "@/lib/content";
import { getSession, canEdit, canAdmin, canCreateSetlist } from "@/lib/auth";
import { isReadOnlyFor } from "@/lib/readonly";
import { generateSetlistVoiceShares } from "@/lib/navidrome/setlist-shares";
import { getSetlistsDir } from "@/lib/content/paths";
import { isReservedSetlistId, isSongItem, type Setlist, type SetlistItem } from "@/lib/content/schemas";
import { parseSetlistItems, validateRecurrentNoteDates } from "@/lib/setlist-items";

export async function GET() {
  const all = await listSetlists();
  const session = await getSession();
  const role = session?.role ?? null;
  // Editors/admins see everything; everyone else sees public setlists plus
  // their own setlists (setlist_creators manage their own collections).
  if (canEdit(role)) return NextResponse.json(all);
  const userId = session?.userId;
  return NextResponse.json(
    all.filter((s) => s.public || (userId ? s.ownerId === userId : false))
  );
}

function readonlyResponse(operation: string) {
  return NextResponse.json({ error: `Read-only mode: ${operation} disabled` }, { status: 403 });
}

/** Compare two item arrays by songId only (order-insensitive); notes/links are ignored */
function songsChanged(oldSongs: SetlistItem[] | undefined, newSongs: SetlistItem[] | undefined): boolean {
  const ids = (items: SetlistItem[] | undefined) =>
    (items ?? []).filter(isSongItem).map((s) => s.songId).sort().join(',');
  const oldIds = ids(oldSongs);
  const newIds = ids(newSongs);
  return oldIds !== newIds;
}

/** Regenerate voice shares if songs array changed and shares exist */
async function maybeRegenerateVoiceShares(
  setlistId: string,
  role: 'public' | 'reviewer' | 'admin' | 'setlist_creator' | null,
  existingShares: { section: string }[] | undefined,
  oldSongs: SetlistItem[] | undefined,
  newSongs: SetlistItem[] | undefined
): Promise<void> {
  if (!existingShares || existingShares.length === 0) return;
  if (!songsChanged(oldSongs, newSongs)) return;
  const voiceRole = role ?? 'public';
  try {
    await generateSetlistVoiceShares({ id: setlistId, songs: newSongs ?? [], voiceShares: existingShares } as Setlist, { role: voiceRole });
    // Note: generateSetlistVoiceShares already saves the setlist with new shares
  } catch {
    // Best effort - voice shares are optional
  }
}

export async function POST(request: Request) {
  if (isReadOnlyFor('setlist_write')) return readonlyResponse("create setlist");
  const session = await getSession();
  if (!canCreateSetlist(session?.role ?? null)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    
    const parsedItems = await parseSetlistItems(data.songs, session?.role ?? null, request);
    if ('error' in parsedItems) {
      return NextResponse.json({ error: parsedItems.error }, { status: parsedItems.status ?? 400 });
    }
    const dateError = await validateRecurrentNoteDates(parsedItems.items);
    if (dateError) return NextResponse.json(dateError, { status: 400 });

    const id = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!id) {
      return NextResponse.json({ error: "title must contain letters or digits" }, { status: 400 });
    }
    if (isReservedSetlistId(id)) {
      return NextResponse.json(
        { error: `"${id}" is reserved and cannot be used as a setlist id; choose another title` },
        { status: 400 },
      );
    }

    const setlist: Setlist = {
      id,
      title: data.title,
      description: data.description || undefined,
      date: data.date || undefined,
      songs: parsedItems.items,
      voiceShares: [],
      public: false,
      ownerId: session?.userId,
      created: new Date().toISOString(),
      subscribers: [],
    };

    await saveSetlist(setlist);
    return NextResponse.json(setlist, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create setlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (isReadOnlyFor('setlist_write')) return readonlyResponse("update setlist");
  const session = await getSession();
  const userId = session?.userId;
  const role = session?.role ?? null;

  if (!canCreateSetlist(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    if (!data.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const parsedItems = await parseSetlistItems(data.songs, session?.role ?? null, request);
    if ('error' in parsedItems) {
      return NextResponse.json({ error: parsedItems.error }, { status: parsedItems.status ?? 400 });
    }

     const editingVersion = typeof data.version === 'string' && data.version && data.version !== 'current'
       ? data.version
       : undefined;

     // Load existing to preserve created date and check ownership
     let existing: Setlist | null = null;
     try {
       existing = await getSetlist(data.id);
     } catch {
       return NextResponse.json({ error: "Setlist not found" }, { status: 404 });
     }

     // Editing a historical dated version: update that version's file only.
     if (editingVersion) {
       try {
         const existingVersion = await getSetlistVersion(data.id, editingVersion);
         const itemsVersion = parsedItems.items;
         const versionDateError = await validateRecurrentNoteDates(itemsVersion, existingVersion.songs);
         if (versionDateError) return NextResponse.json(versionDateError, { status: 400 });
         const updatedVersion: Setlist = {
           ...existingVersion,
           title: data.title,
           description: data.description || undefined,
           date: existingVersion.date,
           image: data.image || existingVersion.image,
           songs: itemsVersion,
           voiceShares: existingVersion.voiceShares ?? [],
           mode: existingVersion.mode,
           modified: new Date().toISOString(),
         };
         const versionDir = path.join(getSetlistsDir(), data.id, editingVersion);
         await mkdir(versionDir, { recursive: true });
         await writeFile(path.join(versionDir, 'setlist.yaml'), yaml.dump(updatedVersion, { lineWidth: -1 }), 'utf-8');
         const updated = await getSetlistVersion(data.id, editingVersion);
         return NextResponse.json(updated);
       } catch {
         return NextResponse.json({ error: "Version not found" }, { status: 404 });
       }
     }

    // Check ownership for setlist_creator role
    const isOwner = existing.ownerId === userId;
    const canEditAll = canEdit(role);
    if (!isOwner && !canEditAll) {
      return NextResponse.json({ error: "Forbidden: not the owner" }, { status: 403 });
    }

    const dateError = await validateRecurrentNoteDates(parsedItems.items, existing?.songs);
    if (dateError) return NextResponse.json(dateError, { status: 400 });

    const newSongs = parsedItems.items;
    const oldSongs = existing?.songs;
    const existingShares = existing?.voiceShares;

    const setlist: Setlist = {
      id: data.id,
      title: data.title,
      description: data.description || undefined,
      date: data.date || undefined,
      songs: newSongs,
      voiceShares: existingShares ?? [],
      public: existing?.public ?? false,
      shareToken: existing?.shareToken,
      shareSlug: existing?.shareSlug,
      ownerId: existing.ownerId,
      created: existing?.created || new Date().toISOString(),
      subscribers: existing?.subscribers ?? [],
    };

    await saveSetlist(setlist);

    // Auto-regenerate voice shares if songs changed
    const voiceRole = (role === 'admin' || role === 'reviewer' || role === 'setlist_creator' || role === 'public') ? role : 'public';
    await maybeRegenerateVoiceShares(data.id, voiceRole, existingShares, oldSongs, newSongs);

    // Re-fetch to get updated voiceShares
    const updated = await getSetlist(data.id);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update setlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (isReadOnlyFor('setlist_write')) return readonlyResponse("delete setlist");
  const session = await getSession();
  const userId = session?.userId;
  const role = session?.role ?? null;

  if (!canCreateSetlist(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const existing = await getSetlist(id);
    const isOwner = existing.ownerId === userId;
    const canEditAll = canAdmin(role);
    if (!isOwner && !canEditAll) {
      return NextResponse.json({ error: "Forbidden: not the owner" }, { status: 403 });
    }

    await deleteSetlist(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete setlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
