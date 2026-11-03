import type { Metadata } from "next";
import NotesList from '@/components/NotesList';
import { isReadOnly } from '@/lib/readonly';

export default function NotesPage() {
  return (
    <div className="p-6 max-w-2xl">
      <NotesList readOnly={isReadOnly()} />
    </div>
  );
}
export const metadata: Metadata = { title: "Notes" };
