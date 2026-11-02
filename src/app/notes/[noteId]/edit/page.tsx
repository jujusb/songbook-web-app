import { notFound, redirect } from "next/navigation";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { NoteForm } from "@/components/NoteForm";

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

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Edit Note</h1>
      <NoteForm isNew={false} noteId={noteId} />
    </div>
  );
}
