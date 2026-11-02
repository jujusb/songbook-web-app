import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEdit } from '@/lib/auth';
import { listSetlistVersions, restoreSetlistVersion } from '@/lib/setlist-history';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ setlistId: string; date: string }> }
) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { setlistId, date } = await params;
  const versions = await listSetlistVersions(setlistId);
  const version = versions.find((v) => v.label === date || v.path === date);
  if (!version) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(version);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ setlistId: string; date: string }> }
) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { setlistId, date } = await params;
  const body = await request.json().catch(() => ({}));
  const version = body?.version || date;
  await restoreSetlistVersion(setlistId, version);
  return NextResponse.json({ success: true });
}
