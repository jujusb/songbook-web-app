import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { getLanguagesConfig } from "@/lib/content";
import { NoteForm } from "@/components/NoteForm";

export default async function NewNotePage() {
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");
  const langConfig = await getLanguagesConfig().catch(() => ({ languages: ['en-US'], default: 'en-US' }));

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">New Recurrent Note</h1>
      <NoteForm isNew={true} languages={langConfig.languages} defaultLanguage={langConfig.default} />
    </div>
  );
}

export const metadata: Metadata = { title: "New Note" };
