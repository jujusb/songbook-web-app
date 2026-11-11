"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { normalizeSetlistMode } from "@/lib/setlist-modes";

export default function SetlistModeSelector({
  setlistId,
  currentMode,
  allowedModes,
}: {
  setlistId: string;
  currentMode: string;
  allowedModes: string[];
}) {
  const { t } = useTranslation();
  const activeMode = normalizeSetlistMode(currentMode);

  return (
    <div className="flex flex-wrap gap-2">
      {allowedModes.map((mode) => {
        const normalized = normalizeSetlistMode(mode);
        return (
          <Link
            key={normalized}
            href={`/setlists/${setlistId}?mode=${normalized}`}
            aria-current={activeMode === normalized ? "page" : undefined}
            className={`px-3 py-1.5 text-sm border rounded-md ${activeMode === normalized ? "bg-blue-600 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
          >
            {t(`setlist.modes.${normalized}`)}
          </Link>
        );
      })}
    </div>
  );
}
