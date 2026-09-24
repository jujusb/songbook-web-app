import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { printStyles } from "@/lib/print/styles";
import { languageLabelFor } from "@/lib/i18n/labels";
import type { PrintSong } from "@/lib/print/types";

/**
 * Shared printable layout (toolbar + title/TOC page + song chapters) used by
 * every "book" render: the songbook print page, setlist print page, and the
 * PDF conversion page. Keeps the print CSS and song chapter markup in one
 * place so all PDF paths produce identical output.
 */
export function PrintSongbook({
  printSongs,
  pageTitle,
  header,
  tocTitle,
  showLangLabels,
  backHref,
  backLabel,
  toolbarChildren,
  emptyText,
}: {
  printSongs: PrintSong[];
  pageTitle: string;
  header?: React.ReactNode;
  tocTitle?: string;
  showLangLabels: boolean;
  backHref: string;
  backLabel: string;
  toolbarChildren?: React.ReactNode;
  emptyText: string;
}) {
  return (
    <div className="print-layout">
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Toolbar (screen only) */}
      <div className="no-print max-w-4xl mx-auto px-4 py-4 mb-8 bg-neutral-100 dark:bg-neutral-900 rounded-lg flex items-center gap-4 flex-wrap">
        <PrintButton />
        {toolbarChildren}
        <Link
          href={backHref}
          className="text-sm text-blue-600 hover:underline ml-auto"
        >
          {backLabel}
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Title page (visible in print) */}
        <div className="toc-print mb-12">
          <h1 className="text-3xl font-bold mb-2">{pageTitle}</h1>
          {header}
          <h2 className="text-xl font-bold mb-4 mt-8">
            {tocTitle ?? "Table of Contents"}
          </h2>
          <ol className="list-decimal pl-6 space-y-1">
            {printSongs.map((song, i) => (
              <li key={`toc-${i}`}>
                <a
                  href={`#song-${song.id}-${song.lang}`}
                  className="text-blue-600 hover:underline print:text-black print:no-underline"
                >
                  {song.title}
                  {showLangLabels && (
                    <span className="text-neutral-400 ml-1 text-xs">
                      ({languageLabelFor(song.lang)})
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
                {showLangLabels && (
                  <span>{languageLabelFor(song.lang)}</span>
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
          <p className="text-neutral-500 py-8">{emptyText}</p>
        )}
      </div>
    </div>
  );
}