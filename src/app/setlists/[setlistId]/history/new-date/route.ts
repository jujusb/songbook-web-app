import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageSetlistHistory } from '@/lib/auth';
import { getSetlist } from '@/lib/content';
import { createSetlistDateVersion } from '@/lib/setlist-history';

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
  try {
    const label = await createSetlistDateVersion(historyId, date, copyCurrent);
    return NextResponse.json({ success: true, date, label });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 400 });
  }
}
