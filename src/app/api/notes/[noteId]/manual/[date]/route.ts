import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEdit } from '@/lib/auth';
import {
  getNoteManualVersion,
  listNoteManualVersions,
  restoreNoteManualVersion,
} from '@/lib/content/notes';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string; date: string }> },
) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) return unauthorized();

  const { noteId, date } = await params;
  const label = request.nextUrl.searchParams.get('label');
  try {
    if (label) {
      const content = await getNoteManualVersion(noteId, date, label);
      return NextResponse.json({ date, label, content });
    }
    const versions = await listNoteManualVersions(noteId, date);
    return NextResponse.json({ date, versions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Not found' },
      { status: 404 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string; date: string }> },
) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) return unauthorized();

  const { noteId, date } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const label = typeof body.label === 'string' ? body.label : '';
  if (!label) return NextResponse.json({ error: 'Missing label' }, { status: 400 });

  try {
    const content = await restoreNoteManualVersion(noteId, date, label);
    const versions = await listNoteManualVersions(noteId, date);
    return NextResponse.json({ success: true, content, versions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 400 },
    );
  }
}
