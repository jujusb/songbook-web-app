"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface HistoryVersion {
  label: string;
  path: string;
  title: string;
  date?: string;
  eventDate?: string;
  description?: string;
}

interface Props {
  /** Setlist id used for links back to the setlist view. */
  setlistId: string;
  /** Setlist whose versions are listed (the original for saved/shared setlists). */
  historySetlistId?: string;
  canEdit: boolean;
  /** Whether this user may restore versions / create dated versions. */
  canManage?: boolean;
  initialVersions: HistoryVersion[];
  currentVersion: string | null;
  /** Optional share token so a public share page can read history. */
  shareToken?: string;
  /** Base URL for selecting a version (defaults to `/setlists/<setlistId>`). */
  versionHrefBase?: string;
}

export function SetlistHistoryBrowser({
  setlistId,
  historySetlistId,
  canEdit,
  canManage,
  initialVersions,
  currentVersion,
  shareToken,
  versionHrefBase,
}: Props) {
  const router = useRouter();
  const targetId = historySetlistId || setlistId;
  const manage = canManage ?? canEdit;
  const [versions, setVersions] = useState<HistoryVersion[]>(initialVersions);
  const [selected, setSelected] = useState<string>(currentVersion || "");

  const shareQuery = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/setlists/${targetId}/history${shareQuery}`);
        if (!cancelled && res.ok) setVersions(await res.json());
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId, shareQuery]);

  const dateOf = (version: HistoryVersion) => version.eventDate || version.date || "";

  return (
    <section className="mt-8 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Version history</h2>
        {manage && (
          <button
            type="button"
            onClick={() => router.push(`/setlists/${targetId}/edit?newDate=1`)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            aria-label="New setlist date"
          >
            New
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          value={selected}
          onChange={(e) => {
            const label = e.target.value;
            setSelected(label);
            const base = versionHrefBase || `/setlists/${setlistId}`;
            if (label) router.push(`${base}?version=${encodeURIComponent(label)}`);
            else router.push(base);
          }}
        >
          <option value="">Current version</option>
          {versions.map((v) => (
            <option key={v.label} value={v.label}>
              {dateOf(v) || v.title || v.label}{v.date && v.eventDate && v.date !== v.eventDate ? ` • ${v.label}` : ""}
            </option>
          ))}
        </select>
        {historySetlistId && historySetlistId !== setlistId && (
          <span className="text-xs text-neutral-400">History from the original setlist</span>
        )}
      </div>
      {versions.some((v) => v.description) && (
        <ul className="mt-3 space-y-1">
          {versions.filter((v) => v.description).map((v) => (
            <li key={v.label} className="text-xs text-neutral-400">{v.label}{v.description ? ` — ${v.description}` : ""}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
