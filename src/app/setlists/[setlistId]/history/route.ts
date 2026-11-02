import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEdit } from '@/lib/auth';
import { listSetlistVersions, restoreSetlistVersion } from '@/lib/setlist-history';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ setlistId: string }> }) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { setlistId } = await params;
  const versions = await listSetlistVersions(setlistId);
  return NextResponse.json(versions);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ setlistId: string }> }) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { setlistId } = await params;
  const body = await request.json().catch(() => ({}));
  if (!body?.version) {
    return NextResponse.json({ error: 'Missing version' }, { status: 400 });
  }
  await restoreSetlistVersion(setlistId, body.version);
  return NextResponse.json({ success: true });
}
