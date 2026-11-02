import { notesApi } from '@/lib/notes';

export const dynamic = 'force-static';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const note = await notesApi.fetchNote(noteId);
 
    if (!note) {
      return new Response(
        JSON.stringify({ error: 'Note not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
 
    return new Response(
      JSON.stringify(note),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching note:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch note' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const body = await request.json();
 
    const updatedNote = await notesApi.updateNote(noteId, body);
 
    return new Response(
      JSON.stringify(updatedNote),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating note:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update note' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
