import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEdit } from '@/lib/auth';
import { getSetlist } from '@/lib/content';
import { listSetlistVersions, restoreSetlistVersion } from '@/lib/setlist-history';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ setlistId: string }> }) {
  const { setlistId } = await params;
  try {
    await getSetlist(setlistId);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
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
