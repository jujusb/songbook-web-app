import { NextRequest, NextResponse } from 'next/server';
import { getSession, canEdit } from '@/lib/auth';
import { getNote } from '@/lib/content/notes';
import { previewApiSection } from '@/lib/note-preview';
import { formatApiSectionPreview } from '@/lib/notes';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string; partId: string }> },
) {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { noteId, partId } = await params;
  const note = await getNote(noteId);
  if (!note) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sections = note.sections || note.content || [];
  const index = Number(partId);
  const section =
    Number.isInteger(index) && index >= 0
      ? sections[index]
      : sections.find((s) => s.name === partId);

  if (!section || section.type !== 'api') {
    return NextResponse.json({ error: 'Part not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return previewApiSection(
    section,
    typeof body.lang === 'string' ? body.lang : undefined,
    typeof body.date === 'string' ? body.date : undefined,
    (data) => formatApiSectionPreview(section, data),
  );
}
