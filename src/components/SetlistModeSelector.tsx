"use client";

import Link from "next/link";

export default function SetlistModeSelector({
  setlistId,
  currentMode,
  allowedModes,
}: {
  setlistId: string;
  currentMode: string;
  allowedModes: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowedModes.map((mode) => (
        <Link
          key={mode}
          href={`/setlists/${setlistId}?mode=${mode}`}
          className={`px-3 py-1.5 text-sm border rounded-md ${currentMode === mode ? "bg-blue-600 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
        >
          {mode}
        </Link>
      ))}
    </div>
  );
}
