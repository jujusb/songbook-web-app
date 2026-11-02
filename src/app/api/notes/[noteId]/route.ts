import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEdit } from '@/lib/auth';
import { getNote, saveNote, deleteNote } from '@/lib/content/notes';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) return unauthorized();
  const { noteId } = await params;
  const note = await getNote(noteId);
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(note);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) return unauthorized();
  const { noteId } = await params;
  const body = await request.json().catch(() => ({}));
  const saved = await saveNote({ ...body, id: noteId });
  return NextResponse.json(saved);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) return unauthorized();
  const { noteId } = await params;
  const ok = await deleteNote(noteId);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
