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
  const [selected, setSelected] = useState<string>(currentVersion || (initialVersions[0]?.label ?? ""));
  const [status, setStatus] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));

  const shareQuery = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";

  async function refresh() {
    try {
      const res = await fetch(`/api/setlists/${targetId}/history${shareQuery}`);
      if (res.ok) setVersions(await res.json());
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/setlists/${targetId}/history${shareQuery}`);
        if (!cancelled && res.ok) setVersions(await res.json());
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId, shareQuery]);

  async function saveNewDate(copy: boolean) {
    if (!newDate) return;
    const res = await fetch(`/api/setlists/${targetId}/history/new-date`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate, copy }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(`Saved version ${data?.label || newDate}`);
      await refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus(data?.error || "Failed");
    }
  }

  const dateOf = (version: HistoryVersion) => version.eventDate || version.date || "";

  return (
    <section className="mt-8 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Version history</h2>
        {manage && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              aria-label="New version date"
            />
            <button type="button" onClick={() => saveNewDate(true)} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">Save date (copy)</button>
            <button type="button" onClick={() => saveNewDate(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">Save date (empty)</button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          value={selected}
          onChange={(e) => {
            const label = e.target.value;
            setSelected(label);
            if (label) {
              const base = versionHrefBase || `/setlists/${setlistId}`;
              router.push(`${base}?version=${encodeURIComponent(label)}`);
            }
          }}
        >
          <option value="">Select version…</option>
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
      {status && <p className="mt-3 text-sm text-neutral-500">{status}</p>}
    </section>
  );
}
