"use client";

import { useState } from "react";
import { PrintSongbook } from "@/components/PrintSongbook";
import { languageLabelFor } from "@/lib/i18n/labels";

const langLabel = languageLabelFor;

interface PrintPageClientProps {
  printSongs: any;
  pageTitle: string;
  header?: React.ReactNode;
  showLangLabels: boolean;
  backHref: string;
  backLabel: string;
  emptyText: string;
  languages: string[];
  showRefs: boolean;
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
}: PrintPageClientProps) {
  const [repeatChorus, setRepeatChorus] = useState(true);

  return (
    <PrintSongbook
      printSongs={printSongs}
      pageTitle={pageTitle}
      header={header}
      showLangLabels={showLangLabels}
      backHref={backHref}
      backLabel={backLabel}
      emptyText={emptyText}
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
              checked={repeatChorus}
              onChange={(e) => setRepeatChorus(e.target.checked)}
              className="w-4 h-4 border border-neutral-300 dark:border-neutral-700 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-neutral-500">Show repeated sections</span>
          </label>
        </>
      }
    />
  );
}
