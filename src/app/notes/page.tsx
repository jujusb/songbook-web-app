import type { Metadata } from "next";
import NotesList from '@/components/NotesList';
import { isReadOnly } from '@/lib/readonly';
import { getLocale, createT } from "@/lib/i18n/server";

export default function NotesPage() {
  return (
    <div className="p-6 max-w-2xl">
      <NotesList readOnly={isReadOnly()} />
    </div>
  );
}
export async function generateMetadata(): Promise<Metadata> {
  const t = createT(await getLocale());
  return { title: t("notesApp.notesTitle") };
}
