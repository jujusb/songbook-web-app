import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEdit } from '@/lib/auth';
import {
  getNoteManualPeriod,
  listNoteManualVersions,
  saveNoteManualPeriod,
} from '@/lib/content/notes';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) return unauthorized();

  const { noteId } = await params;
  const date = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const [content, versions] = await Promise.all([
    getNoteManualPeriod(noteId, date),
    listNoteManualVersions(noteId, date),
  ]);
  return NextResponse.json({ date, content, versions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) return unauthorized();

  const { noteId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const date = typeof body.date === 'string' ? body.date : '';
  const sections = body.sections;
  if (!date || !sections || typeof sections !== 'object' || Array.isArray(sections)) {
    return NextResponse.json({ error: 'Missing date or sections' }, { status: 400 });
  }

  try {
    const content = await saveNoteManualPeriod(
      noteId,
      date,
      sections as Record<string, { md?: string; mdByLanguage?: Record<string, string> }>,
    );
    const versions = await listNoteManualVersions(noteId, date);
    return NextResponse.json({ success: true, content, versions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 400 },
    );
  }
}
