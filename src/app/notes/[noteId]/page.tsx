import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getNote } from "@/lib/content/notes";
import { NoteView } from "@/components/NoteView";
import { getCurrentUser } from "@/lib/auth";
import { getLocale, createT } from "@/lib/i18n/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateParam(value: string | undefined): string | undefined {
  return typeof value === "string" && DATE_RE.test(value) ? value : undefined;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<{ date?: string }>;
}): Promise<Metadata> {
  const { noteId } = await params;
  const { date } = await searchParams;
  const note = await getNote(noteId);
  const when = dateParam(date);
  const t = createT(await getLocale());
  const title = note?.title || t("notesApp.untitled");
  return { title: when ? `${title} - ${when}` : title };
}

export default async function NoteViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { noteId } = await params;
  if (!noteId) notFound();
  const { date } = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  return (
    <NoteView
      noteId={noteId}
      autoScrollSpeed={user?.autoScrollSpeed}
      initialDate={dateParam(date)}
    />
  );
}