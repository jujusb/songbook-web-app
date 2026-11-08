import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { getNote } from "@/lib/content/notes";
import { getLanguagesConfig } from "@/lib/content";
import { NoteManualEditor } from "@/components/NoteManualEditor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ noteId: string }>;
}): Promise<Metadata> {
  const { noteId } = await params;
  const note = await getNote(noteId);
  return { title: note ? `${note.title} - Manual text` : "Manual text" };
}

export default async function NoteManualPage({
  params,
  searchParams,
}: {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { noteId } = await params;
  if (!noteId) notFound();

  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");

  const note = await getNote(noteId);
  if (!note) notFound();

  const { date } = await searchParams;
  const initialDate =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);
  const langConfig = await getLanguagesConfig().catch(() => ({
    languages: ["en-US"],
    default: "en-US",
  }));

  return (
    <NoteManualEditor
      noteId={noteId}
      note={note}
      languages={langConfig.languages}
      initialDate={initialDate}
    />
  );
}
