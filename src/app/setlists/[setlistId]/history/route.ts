import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEdit, canViewSetlist } from '@/lib/auth';
import { getSetlist } from '@/lib/content';
import { listSetlistVersions } from '@/lib/setlist-history';

async function resolveSetlist(setlistId: string) {
  const setlist = await getSetlist(setlistId);
  const historyId = setlist.sharedFrom?.setlistId ?? setlistId;
  const source = setlist.sharedFrom ? await getSetlist(historyId) : setlist;
  return { setlist, source, historyId };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ setlistId: string }> }) {
  const { setlistId } = await params;
  let resolved;
  try {
    resolved = await resolveSetlist(setlistId);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await getSession();
  const userId = session?.userId;
  const role = session?.role ?? null;
  const isEditor = canEdit(role);
  const isOwner = !!userId && (resolved.setlist.ownerId === userId || resolved.source.ownerId === userId);
  const isSubscriber = !!userId && (resolved.setlist.subscribers ?? []).includes(userId);
  const share = request.nextUrl.searchParams.get('share') ?? undefined;
  if (!isOwner && !canViewSetlist(resolved.setlist, share, isEditor, isSubscriber) && !canViewSetlist(resolved.source, share, isEditor, isSubscriber)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const versions = await listSetlistVersions(resolved.historyId);
  return NextResponse.json(versions);
}
