import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEdit } from '@/lib/auth';
import { previewApiSection } from '@/lib/note-preview';
import type { NoteSection } from '@/lib/notes';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const section = body.section as NoteSection | undefined;
  if (!section || section.type !== 'api') {
    return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
  }

  return previewApiSection(
    section,
    typeof body.lang === 'string' ? body.lang : undefined,
    typeof body.date === 'string' ? body.date : undefined,
  );
}
