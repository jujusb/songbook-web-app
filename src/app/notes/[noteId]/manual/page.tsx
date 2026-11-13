import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { getNote } from "@/lib/content/notes";
import { getLanguagesConfig } from "@/lib/content";
import { NoteManualEditor } from "@/components/NoteManualEditor";
import { noteApplicableLanguages } from "@/lib/notes";
import { getLocale, createT } from "@/lib/i18n/server";

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
  const when = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? ` - ${date}` : "";
  const t = createT(await getLocale());
  return { title: note ? `${t("notesApp.manualTitle", { title: note.title })}${when}` : t("notesApp.manualText") };
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
      key={initialDate}
      noteId={noteId}
      note={note}
      languages={noteApplicableLanguages(note.sections || note.content, langConfig.languages)}
      initialDate={initialDate}
    />
  );
}
