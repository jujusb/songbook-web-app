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
  const translationsContent = Object.fromEntries(
    await Promise.all(
      translations.map(async (l) => [l, (await getSongTranslation(songId, l)).body] as const),
    ),
  );
  const langConfig = await getLanguagesConfig();
  const allLanguages = langConfig.languages;
  // Use all configured languages + any song-specific languages
  const languages = Array.from(new Set([...allLanguages, ...translations]));

  const localizedTitle = await getSongTitle(songId, lang);

  return (
    <EditPageClient
      songId={songId}
      lang={lang}
      initialContent={translation.body}
      references={meta.references}
      spotify={meta.spotify}
      youtube={meta.youtube}
      languages={languages}
      translations={translations}
      translationsContent={translationsContent}
      title={localizedTitle}
      status={translation.meta.status}
      keySignature={meta.key}
      initialShowReferences={showRefs === '1'}
    />
  );
}
