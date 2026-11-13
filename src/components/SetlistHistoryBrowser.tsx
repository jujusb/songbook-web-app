"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DateCalendar } from "@/components/DateCalendar";

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
  /** Date of the current setlist (the one opened without `?version`). */
  currentDate?: string;
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
  currentDate = "",
}: Props) {
  const router = useRouter();
  const targetId = historySetlistId || setlistId;
  const manage = canManage ?? canEdit;
  const [versions, setVersions] = useState<HistoryVersion[]>(initialVersions);

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

  // One dated version per day: the latest label wins when several share a date.
  const versionByDate = new Map<string, string>();
  for (const v of versions) {
    if (v.label === "current") continue;
    const d = dateOf(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) versionByDate.set(d, v.label);
  }
  // The day of the version on screen; the current setlist when none is selected.
  const viewedEntry = currentVersion && currentVersion !== "current"
    ? versions.find((v) => v.label === currentVersion)
    : undefined;
  const viewedDate = viewedEntry ? dateOf(viewedEntry) : currentDate;

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
        <DateCalendar
          value={viewedDate}
          marked={new Set([...versionByDate.keys(), ...(currentDate ? [currentDate] : [])])}
          isSelectable={(date) => versionByDate.has(date) || date === currentDate}
          onChange={(date) => {
            const label = date === currentDate ? null : versionByDate.get(date) ?? null;
            const base = versionHrefBase || `/setlists/${setlistId}`;
            const query = shareToken && !versionHrefBase ? `&share=${encodeURIComponent(shareToken)}` : "";
            if (label) router.push(`${base}?version=${encodeURIComponent(label)}${query}`, { scroll: false });
            else router.push(shareToken && !versionHrefBase ? `${base}?share=${encodeURIComponent(shareToken)}` : base, { scroll: false });
          }}
          footer={<>Days with a dot have a saved version. Click one to open it; the selected day is the one on screen.</>}
        />
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
