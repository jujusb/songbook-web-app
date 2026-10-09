"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PrintSongbook } from "@/components/PrintSongbook";
import { languageLabelFor } from "@/lib/i18n/labels";
import type { PrintSong } from "@/lib/print/types";

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
  primaryLang,
}: PrintPageClientProps) {
  const [repeatChorus, setRepeatChorus] = useState(initialRepeatChorus);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleRepeatChorusChange = (checked: boolean) => {
    setRepeatChorus(checked);
    const params = new URLSearchParams(searchParams.toString());
    params.set("repeatChorus", checked ? "true" : "false");
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
              onChange={(e) => handleRepeatChorusChange(e.target.checked)}
              className="w-4 h-4 border border-neutral-300 dark:border-neutral-700 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-neutral-500">Show repeated sections</span>
          </label>
        </>
      }
    />
  );
}
