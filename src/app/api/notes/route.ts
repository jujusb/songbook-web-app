import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, canEdit } from '@/lib/auth';
import { getAllNotes, saveNote } from '@/lib/content/notes';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET() {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) return unauthorized();
  const notes = await getAllNotes();
  return NextResponse.json(notes);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const saved = await saveNote(body);
  return NextResponse.json(saved, { status: 201 });
}
