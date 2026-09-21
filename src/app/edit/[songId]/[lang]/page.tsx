import { notFound, redirect } from "next/navigation";
import { getSong, getSongTitle, getSongTranslation, getSongTranslations, getLanguagesConfig } from "@/lib/content";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { EditPageClient } from "@/components/EditPageClient";

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ songId: string; lang: string }>;
  searchParams: Promise<{ references?: string }>;
}) {
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");

  const { songId, lang } = await params;
  const { references: showRefs } = await searchParams;

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

  const translations = await getSongTranslations(songId);
  const langConfig = await getLanguagesConfig();
  const allLanguages = langConfig.languages.map((l) => l.code);
  // Use all configured languages + any song-specific languages
  const languages = Array.from(new Set([...allLanguages, ...translations]));

  const localizedTitle = await getSongTitle(songId, lang);

  return (
    <EditPageClient
      songId={songId}
      lang={lang}
      initialContent={translation.body}
      references={meta.references}
      languages={languages}
      translations={translations}
      title={localizedTitle}
      status={translation.meta.status}
      initialShowReferences={showRefs === '1'}
    />
  );
}
