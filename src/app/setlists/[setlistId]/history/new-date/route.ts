import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageSetlistHistory } from '@/lib/auth';
import { getSetlist } from '@/lib/content';
import { createSetlistDateVersion } from '@/lib/setlist-history';
import { parseSetlistItems } from '@/lib/setlist-items';

export async function POST(request: NextRequest, { params }: { params: Promise<{ setlistId: string }> }) {
  const session = await getSession();
  const { setlistId } = await params;

  let setlist;
  let historyId = setlistId;
  let source;
  try {
    setlist = await getSetlist(setlistId);
    historyId = setlist.sharedFrom?.setlistId ?? setlistId;
    source = setlist.sharedFrom ? await getSetlist(historyId) : setlist;
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!canManageSetlistHistory(session?.role ?? null, source, session?.userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const date = body?.date || new Date().toISOString().slice(0, 10);
  const copyCurrent = body?.copy !== false;

  const hasContent =
    body?.title !== undefined ||
    body?.description !== undefined ||
    body?.image !== undefined ||
    body?.songs !== undefined;

  let content;
  if (hasContent) {
    if (typeof body?.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    const parsedItems = await parseSetlistItems(body.songs, session?.role ?? null, request);
    if ('error' in parsedItems) {
      return NextResponse.json({ error: parsedItems.error }, { status: parsedItems.status ?? 400 });
    }
    content = {
      title: body.title.trim(),
      description: typeof body.description === 'string' ? body.description.trim() || undefined : undefined,
      image: typeof body.image === 'string' ? body.image.trim() || undefined : undefined,
      songs: parsedItems.items,
    };
  }

  try {
    const label = await createSetlistDateVersion(historyId, date, copyCurrent, content);
    return NextResponse.json({ success: true, date, label });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 400 });
  }
}
