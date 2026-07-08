import { notFound } from "next/navigation";
import { getSong, getSongTranslation, getSongTranslations } from "@/lib/content";
import { PresentationView } from "@/components/PresentationView";

export default async function PresentPage({
  params,
  searchParams,
}: {
  params: Promise<{ songId: string }>;
  searchParams: Promise<{ lang?: string; display?: string }>;
}) {
  const { songId } = await params;
  const { lang: langParam, display } = await searchParams;

  let meta;
  try {
    meta = await getSong(songId);
  } catch {
    notFound();
  }

  const translations = await getSongTranslations(songId);
  const lang = langParam && translations.includes(langParam) ? langParam : translations[0];

  if (!lang) notFound();

  const { body } = await getSongTranslation(songId, lang);

  return (
    <PresentationView
      songId={songId}
      title={meta.title}
      source={body}
      isAudience={display === "audience"}
    />
  );
}
