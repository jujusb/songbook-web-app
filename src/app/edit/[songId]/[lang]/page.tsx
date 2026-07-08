import { notFound } from "next/navigation";
import { getSong, getSongTranslation } from "@/lib/content";
import { EditorView } from "@/components/EditorView";

export default async function EditPage({
  params,
}: {
  params: Promise<{ songId: string; lang: string }>;
}) {
  const { songId, lang } = await params;

  let meta;
  try {
    meta = await getSong(songId);
  } catch {
    notFound();
  }

  let translation;
  try {
    translation = await getSongTranslation(songId, lang);
  } catch {
    notFound();
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-950">
        <div>
          <h1 className="font-semibold">{meta.title}</h1>
          <span className="text-xs text-neutral-500">
            Editing: {lang.toUpperCase()} &middot; Status: {translation.meta.status}
          </span>
        </div>
      </div>
      <EditorView
        songId={songId}
        lang={lang}
        initialContent={translation.body}
      />
    </div>
  );
}
