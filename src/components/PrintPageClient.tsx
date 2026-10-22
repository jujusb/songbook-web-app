"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PrintSongbook } from "@/components/PrintSongbook";
import { languageLabelFor } from "@/lib/i18n/labels";
import type { PrintSong } from "@/lib/print/types";
import type { Orientation } from "@/lib/chordpro/notation";

const langLabel = languageLabelFor;

interface PrintPageClientProps {
  printSongs: PrintSong[];
  pageTitle: string;
  header?: React.ReactNode;
  showLangLabels: boolean;
  backHref: string;
  backLabel: string;
  emptyText: string;
  languages: string[];
  showRefs: boolean;
  repeatChorus: boolean;
  showChords: boolean;
  chordNotation: "letters" | "solfege" | "roman" | "nashville";
  orientation: Orientation;
  columns: "1" | "2";
  tocColumns: "1" | "2" | "3";
  primaryLang: string;
}

export function PrintPageClient({
  printSongs,
  pageTitle,
  header,
  showLangLabels,
  backHref,
  backLabel,
  emptyText,
  languages,
  showRefs,
  repeatChorus: initialRepeatChorus,
  showChords: initialShowChords,
  chordNotation: initialChordNotation,
  orientation: initialOrientation,
  columns: initialColumns,
  tocColumns: initialTocColumns,
  primaryLang,
}: PrintPageClientProps) {
  const [repeatChorus, setRepeatChorus] = useState(initialRepeatChorus);
  const [showChords, setShowChords] = useState(initialShowChords);
  const [chordNotation, setChordNotation] = useState<"letters" | "solfege" | "roman" | "nashville">(initialChordNotation);
  const [orientation] = useState<Orientation>(initialOrientation);
  const [columns] = useState<"1" | "2">(initialColumns);
  const [tocColumns] = useState<"1" | "2" | "3">(initialTocColumns);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleRepeatChorusChange = (checked: boolean) => {
    setRepeatChorus(checked);
    const params = new URLSearchParams(searchParams.toString());
    params.set("repeatChorus", checked ? "true" : "false");
    router.push(`/print/${primaryLang}?${params.toString()}`);
  };

  const handleShowChordsChange = (checked: boolean) => {
    setShowChords(checked);
    const params = new URLSearchParams(searchParams.toString());
    params.set("showChords", checked ? "true" : "false");
    router.push(`/print/${primaryLang}?${params.toString()}`);
  };

  const handleChordNotationChange = (next: "letters" | "solfege" | "roman" | "nashville") => {
    setChordNotation(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("chordNotation", next);
    router.push(`/print/${primaryLang}?${params.toString()}`);
  };

  return (
    <PrintSongbook
      printSongs={printSongs}
      pageTitle={pageTitle}
      header={header}
      showLangLabels={showLangLabels}
      backHref={backHref}
      backLabel={backLabel}
      emptyText={emptyText}
      showChords={showChords}
      orientation={orientation}
      columns={columns}
      tocColumns={tocColumns}
      toolbarChildren={
        <>
          <span className="text-sm text-neutral-500">
            {printSongs.length} song{printSongs.length !== 1 ? "s" : ""}
            {" · "}
            {languages.map(langLabel).join(", ")}
            {showRefs && " · with references"}
          </span>
          <label className="flex items-center gap-2 ml-4 text-sm">
            <input
              type="checkbox"
              checked={showChords}
              onChange={(e) => handleShowChordsChange(e.target.checked)}
              className="w-4 h-4 border border-neutral-300 dark:border-neutral-700 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-neutral-500">Show chords</span>
          </label>
          <label className="flex items-center gap-2 ml-4 text-sm">
            <input
              type="checkbox"
              checked={repeatChorus}
              onChange={(e) => handleRepeatChorusChange(e.target.checked)}
              className="w-4 h-4 border border-neutral-300 dark:border-neutral-700 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-neutral-500">Show repeated sections</span>
          </label>
          <div className="flex items-center gap-1 ml-4">
            <span className="text-xs text-neutral-400">Notation:</span>
            {["letters", "solfege", "roman", "nashville"].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleChordNotationChange(n as "letters" | "solfege" | "roman" | "nashville")}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  chordNotation === n
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                }`}
              >
                {n === "letters" ? "Letters" : n === "solfege" ? "Solfège" : n === "roman" ? "Roman" : "Nashville"}
              </button>
            ))}
          </div>
        </>
      }
    />
  );
}
