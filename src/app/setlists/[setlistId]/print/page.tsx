import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  getSetlist,
  getSong,
  getSongTranslations,
  getSongTitle,
  getSongTranslation,
  getLanguagesConfig,
  shouldShowSongInLanguage,
  getSiteConfig,
} from "@/lib/content";
import { renderToHtml, renderReferencesHtml } from "@/lib/chordpro";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canEdit, canViewSetlist } from "@/lib/auth";
import { languageLabelFor } from "@/lib/i18n/labels";
import { PrintButton } from "@/components/PrintButton";

interface PrintSong {
  songId: string;
  title: string;
  key?: string;
  lang: string;
  html: string;
  refsHtml: string;
}

export default async function SetlistPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ share?: string; lang?: string }>;
}) {
  const { setlistId } = await params;
  const { share, lang } = await searchParams;
  const shareParam = typeof share === "string" ? share : undefined;

  let setlist;
  try {
    setlist = await getSetlist(setlistId);
  } catch {
    notFound();
  }

  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);
  if (!canViewSetlist(setlist, shareParam, showEditActions)) {
    notFound();
  }

  const langConfig = await getLanguagesConfig();
  const cookieLang = getLocale(await cookies(), langConfig.default);
  const selectedLang =
    typeof lang === "string" &&
    (lang === langConfig.default || langConfig.languages.includes(lang))
      ? lang
      : cookieLang;

  const songDetails = await Promise.all(
    setlist.songs.map(async (item) => {
      try {
        const meta = await getSong(item.songId);
        const translations = await getSongTranslations(item.songId);
        return {
          ...item,
          title: await getSongTitle(item.songId, item.lang),
          key: meta.key,
          translations,
          references: meta.references,
        };
      } catch {
        return {
          ...item,
          title: item.songId,
          key: undefined,
          translations: [] as string[],
          references: undefined,
        };
      }
    })
  );

  // The "current selection": editors see every song in the setlist, everyone
  // else sees the songs filtered for the currently selected language — the
  // same list the setlist page displays.
  const selected = showEditActions
    ? songDetails
    : songDetails.filter((song) =>
        shouldShowSongInLanguage(
          song.translations,
          selectedLang,
          langConfig.default
        )
      );

  const printSongs: PrintSong[] = [];
  for (const song of selected) {
    try {
      const { body } = await getSongTranslation(song.songId, song.lang);
      printSongs.push({
        songId: song.songId,
        title: song.title,
        key: song.key,
        lang: song.lang,
        html: renderToHtml(body),
        refsHtml:
          song.references?.length
            ? renderReferencesHtml(song.references, song.lang)
            : "",
      });
    } catch {
      continue;
    }
  }

  let siteTitle = "Songbook";
  try {
    const config = await getSiteConfig();
    siteTitle = config.title;
  } catch {}

  const printStyles = `
    @media print {
      .no-print { display: none !important; }
      header { display: none !important; }
      .song-page { page-break-after: always; }
      .song-page:last-child { page-break-after: auto; }
      .toc-print { page-break-after: always; }
      @page { margin: 2cm; size: A4; }
      .song-references { margin-top: 1em; padding-top: 0.75em; border-top: 1px solid #ccc; }
      .song-references .ref-header { font-size: 0.7em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 0.3em; }
      .song-references ul { list-style: disc; padding-left: 1.2em; font-size: 0.85em; }
      .song-references li { margin-bottom: 0.3em; }
      .song-references a { color: #333; text-decoration: none; }
      .song-references .ref-text { margin-top: 0.2em; font-style: italic; font-size: 0.9em; color: #555; padding-left: 0.5em; border-left: 2px solid #ccc; }
      .song-references mark { background: #fef3c7; color: #92400e; padding: 0 0.15em; border-radius: 2px; }
    }
    @media screen {
      .song-references { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-neutral-200); }
      .song-references .ref-header { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-neutral-400); margin-bottom: 0.5rem; }
      .song-references ul { list-style: disc; padding-left: 1.2rem; font-size: 0.85rem; }
      .song-references li { margin-bottom: 0.4rem; }
      .song-references a { color: var(--color-blue-600); }
      .song-references .ref-text { margin-top: 0.25rem; font-style: italic; font-size: 0.85em; color: var(--color-neutral-500); padding-left: 0.5rem; border-left: 2px solid var(--color-neutral-200); line-height: 1.5; }
      .song-references mark { background: #fef3c7; color: #92400e; padding: 0 0.15em; border-radius: 2px; }
    }
  `;

  const backHref = `/setlists/${setlist.id}${
    shareParam ? `?share=${shareParam}` : ""
  }`;

  return (
    <div className="print-layout">
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      <div className="no-print max-w-4xl mx-auto px-4 py-4 mb-8 bg-neutral-100 dark:bg-neutral-900 rounded-lg flex items-center gap-4 flex-wrap">
        <PrintButton />
        <span className="text-sm text-neutral-500">
          {printSongs.length} song{printSongs.length !== 1 ? "s" : ""} &middot;{" "}
          {siteTitle}
        </span>
        <Link
          href={backHref}
          className="text-sm text-blue-600 hover:underline ml-auto"
        >
          Back to Setlist
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <div className="toc-print mb-12">
          <h1 className="text-3xl font-bold mb-2">{setlist.title}</h1>
          {setlist.date && <p className="text-neutral-500">{setlist.date}</p>}
          {setlist.description && (
            <p className="text-neutral-500 text-sm mt-2 mb-6">
              {setlist.description}
            </p>
          )}

          <h2 className="text-xl font-bold mb-4 mt-8">Songs</h2>
          <ol className="list-decimal pl-6 space-y-1">
            {printSongs.map((song, i) => (
              <li key={`toc-${i}`}>
                <a
                  href={`#song-${song.songId}-${song.lang}`}
                  className="text-blue-600 hover:underline print:text-black print:no-underline"
                >
                  {song.title}
                  <span className="text-neutral-400 ml-1 text-xs">
                    ({languageLabelFor(song.lang)})
                  </span>
                </a>
                {song.key && (
                  <span className="text-xs text-neutral-400 ml-2">
                    {song.key}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>

        {printSongs.map((song, i) => (
          <div
            key={`${song.songId}-${song.lang}-${i}`}
            id={`song-${song.songId}-${song.lang}`}
            className="song-page mb-12"
          >
            <div className="mb-4 pb-2 border-b border-neutral-200 dark:border-neutral-800 flex items-baseline justify-between">
              <h2 className="text-2xl font-bold">{song.title}</h2>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                {song.key && <span>Key: {song.key}</span>}
                <span>{languageLabelFor(song.lang)}</span>
              </div>
            </div>
            <div
              className="visual-chord-editor visual-chord-sheet"
              dangerouslySetInnerHTML={{ __html: song.html }}
            />
            {song.refsHtml && (
              <div dangerouslySetInnerHTML={{ __html: song.refsHtml }} />
            )}
          </div>
        ))}

        {printSongs.length === 0 && (
          <p className="text-neutral-500 py-8">No songs to print.</p>
        )}
      </div>
    </div>
  );
}