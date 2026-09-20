import {
  listSongs,
  getSong,
  getSongTranslation,
  getSongTranslations,
  getAlbum,
  getLanguagesConfig,
  getSiteConfig,
} from "@/lib/content";
import { renderToHtml, renderReferencesHtml } from "@/lib/chordpro";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";

interface PrintSong {
  id: string;
  title: string;
  key?: string;
  lang: string;
  html: string;
  refsHtml: string;
}

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    album?: string;
    refs?: string;
    langs?: string;
  }>;
}) {
  const { lang: primaryLang } = await params;
  const { album: albumId, refs: showRefsParam, langs: langsParam } = await searchParams;

  const showRefs = showRefsParam === "1" || showRefsParam === "true";

  // Determine which languages to include
  let languages: string[];
  if (primaryLang === "all") {
    // All languages mode — use langs param or all configured
    if (langsParam) {
      languages = langsParam.split(",").map((l) => l.trim()).filter(Boolean);
    } else {
      const langConfig = await getLanguagesConfig();
      languages = langConfig.languages.map((l) => l.code);
    }
  } else {
    // Single language mode (may include additional via langs param)
    languages = [primaryLang];
    if (langsParam) {
      const extra = langsParam.split(",").map((l) => l.trim()).filter(Boolean);
      for (const l of extra) {
        if (!languages.includes(l)) languages.push(l);
      }
    }
  }

  // Determine scope — album or full songbook
  let scopeTitle = "Songbook";
  let songIds: string[] | null = null; // null = all songs

  if (albumId) {
    try {
      const album = await getAlbum(albumId);
      scopeTitle = album.titles?.[primaryLang] || album.title;
      songIds = album.songs;
    } catch {
      // album not found, fall through to full songbook
    }
  }

  // Load songs
  const allSongs = await listSongs();
  const targetSongs = songIds
    ? songIds.map((id) => allSongs.find((s) => s.id === id)).filter(Boolean)
    : allSongs.sort((a, b) => a.title.localeCompare(b.title));

  // For each song, for each language, load translation + references
  const printSongs: PrintSong[] = [];

  for (const song of targetSongs) {
    if (!song) continue;
    const availableTranslations = await getSongTranslations(song.id);
    const songMeta = showRefs ? await getSong(song.id).catch(() => null) : null;

    for (const lang of languages) {
      if (!availableTranslations.includes(lang)) continue;
      try {
        const { body } = await getSongTranslation(song.id, lang);
        const html = renderToHtml(body);
        const refsHtml = showRefs && songMeta?.references?.length
          ? renderReferencesHtml(songMeta.references, lang)
          : "";
        printSongs.push({
          id: song.id,
          title: song.titles?.[lang] || song.choTitles?.[lang] || song.title,
          key: song.key,
          lang,
          html,
          refsHtml,
        });
      } catch {
        // skip
      }
    }
  }

  // Build language label for display
  const langConfig = await getLanguagesConfig().catch(() => null);
  const langLabel = (code: string) => {
    if (!langConfig) return code.toUpperCase();
    const found = langConfig.languages.find((l) => l.code === code);
    return found ? found.label : code.toUpperCase();
  };

  let siteTitle = "Songbook";
  try {
    const config = await getSiteConfig();
    siteTitle = config.title;
  } catch {}

  const pageTitle = albumId
    ? `${scopeTitle} — ${languages.map(langLabel).join(", ")}`
    : `${siteTitle} — ${languages.map(langLabel).join(", ")}`;

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

  return (
    <div className="print-layout">
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Toolbar (screen only) */}
      <div className="no-print max-w-4xl mx-auto px-4 py-4 mb-8 bg-neutral-100 dark:bg-neutral-900 rounded-lg flex items-center gap-4 flex-wrap">
        <PrintButton />
        <span className="text-sm text-neutral-500">
          {printSongs.length} song{printSongs.length !== 1 ? "s" : ""} &middot;{" "}
          {languages.map(langLabel).join(", ")}
          {showRefs && " \u00b7 with references"}
        </span>
        <Link
          href={albumId ? `/albums/${albumId}` : "/print"}
          className="text-sm text-blue-600 hover:underline ml-auto"
        >
          {albumId ? "Back to Album" : "Back to Print Options"}
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Title page (visible in print) */}
        <div className="toc-print mb-12">
          <h1 className="text-3xl font-bold mb-2">{pageTitle}</h1>
          {albumId && (
            <p className="text-neutral-500 mb-6">{scopeTitle}</p>
          )}

          {/* Table of Contents */}
          <h2 className="text-xl font-bold mb-4 mt-8">Table of Contents</h2>
          <ol className="list-decimal pl-6 space-y-1">
            {printSongs.map((song, i) => (
              <li key={`toc-${i}`}>
                <a
                  href={`#song-${song.id}-${song.lang}`}
                  className="text-blue-600 hover:underline print:text-black print:no-underline"
                >
                  {song.title}
                  {languages.length > 1 && (
                    <span className="text-neutral-400 ml-1 text-xs">
                      ({langLabel(song.lang)})
                    </span>
                  )}
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

        {/* Songs */}
        {printSongs.map((song, i) => (
          <div
            key={`${song.id}-${song.lang}-${i}`}
            id={`song-${song.id}-${song.lang}`}
            className="song-page mb-12"
          >
            <div className="mb-4 pb-2 border-b border-neutral-200 dark:border-neutral-800 flex items-baseline justify-between">
              <h2 className="text-2xl font-bold">{song.title}</h2>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                {song.key && <span>Key: {song.key}</span>}
                {languages.length > 1 && (
                  <span>{langLabel(song.lang)}</span>
                )}
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
          <p className="text-neutral-500 py-8">
            No songs found for the selected language(s).
          </p>
        )}
      </div>
    </div>
  );
}
