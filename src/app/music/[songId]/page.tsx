import Link from "next/link";
import { notFound } from "next/navigation";
import { getSong, getSongTitle, getSongTranslation, getSongTranslations } from "@/lib/content";
import { getSession, canEdit } from "@/lib/auth";
import { MusicReader } from "@/components/MusicReader";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getLocale } from "@/lib/i18n/server";
import { createT } from "@/lib/i18n/server";

export default async function MusicReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ songId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { songId } = await params;
  const { lang: langParam } = await searchParams;
  const locale = await getLocale();
  const t = createT(locale);

  let meta;
  try {
    meta = await getSong(songId);
  } catch {
    notFound();
  }

  const translations = await getSongTranslations(songId);
  const lang =
    langParam && translations.includes(langParam) ? langParam : translations[0] || "en";

  let chordBody = "";
  try {
    const trans = await getSongTranslation(songId, lang);
    chordBody = trans.body;
  } catch {
    // no translation yet
  }

  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);
  const localizedTitle = await getSongTitle(songId, lang);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href={`/songs/${songId}`}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
      >
        &larr; {localizedTitle}
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{localizedTitle}</h1>
          {meta.key && (
            <span className="text-sm text-neutral-500 mt-1 block">
              Key: {meta.key}
            </span>
          )}
        </div>
        <div className="flex gap-2 text-sm">
          {showEditActions && (
            <Link
              href={`/edit/${songId}/${lang}`}
              className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Edit
            </Link>
          )}
          <Link
            href={`/present/${songId}?lang=${lang}`}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Present
          </Link>
        </div>
      </div>

      {translations.length > 1 && (
        <div className="mb-6">
          <LanguageSwitcher
            songId={songId}
            languages={translations}
            currentLang={lang}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Music reader */}
        <div>
          <MusicReader
            audioFiles={meta.audioFiles ?? []}
            songTitle={localizedTitle}
          />
        </div>

        {/* Chord sheet */}
        {chordBody && (
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">
              Chord Chart
            </div>
            <pre className="text-sm leading-relaxed font-mono whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 border border-neutral-200 dark:border-neutral-800 max-h-[70vh] overflow-y-auto">
              {chordBody}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
