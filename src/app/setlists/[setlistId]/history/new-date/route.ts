import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEdit } from '@/lib/auth';
import { createSetlistDateVersion } from '@/lib/setlist-history';

export async function POST(request: NextRequest, { params }: { params: Promise<{ setlistId: string }> }) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { setlistId } = await params;
  const body = await request.json().catch(() => ({}));
  const date = body?.date || new Date().toISOString().slice(0, 10);
  const copyCurrent = body?.copy !== false;
  try {
    await createSetlistDateVersion(setlistId, date, copyCurrent);
    return NextResponse.json({ success: true, date });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 400 });
  }
}
