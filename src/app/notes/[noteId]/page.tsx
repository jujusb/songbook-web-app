import { notFound } from "next/navigation";
import { NoteView } from "@/components/NoteView";

export default async function NoteViewPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  if (!noteId) notFound();
  return <NoteView noteId={noteId} />;
}