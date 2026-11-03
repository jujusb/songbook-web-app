import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { NoteForm } from "@/components/NoteForm";
import { getNote } from "@/lib/content/notes";
import { getLanguagesConfig } from "@/lib/content";

export async function generateMetadata({ params }: { params: Promise<{ noteId: string }> }): Promise<Metadata> {
  const { noteId } = await params;
  const note = await getNote(noteId);
  return { title: note ? `${note.title} - Edit` : "Edit Note" };
}

export default async function NoteEditPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;

  if (!noteId) {
    notFound();
  }

  // Check permissions
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");
  const langConfig = await getLanguagesConfig().catch(() => ({ languages: ['en-US'], default: 'en-US' }));

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Edit Note</h1>
      <NoteForm isNew={false} noteId={noteId} languages={langConfig.languages} defaultLanguage={langConfig.default} />
    </div>
  );
}
