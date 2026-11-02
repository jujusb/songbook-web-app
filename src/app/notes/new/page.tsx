import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { NoteForm } from "@/components/NoteForm";

export default async function NewNotePage() {
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">New Recurrent Note</h1>
      <NoteForm isNew={true} />
    </div>
  );
}

export const metadata: Metadata = { title: "New Note" };
