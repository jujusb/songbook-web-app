import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getNote } from "@/lib/content/notes";
import { NoteView } from "@/components/NoteView";
import { getCurrentUser } from "@/lib/auth";

export async function generateMetadata({ params }: { params: Promise<{ noteId: string }> }): Promise<Metadata> {
  const { noteId } = await params;
  const note = await getNote(noteId);
  return { title: note?.title || "Note" };
}

export default async function NoteViewPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  if (!noteId) notFound();
  const user = await getCurrentUser().catch(() => null);
  return <NoteView noteId={noteId} autoScrollSpeed={user?.autoScrollSpeed} />;
}