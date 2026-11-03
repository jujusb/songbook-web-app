"use client";

import { useEffect, useState } from "react";

interface HistoryVersion {
  label: string;
  path: string;
  title: string;
  date?: string;
}

interface Props {
  setlistId: string;
  canEdit: boolean;
  initialVersions: HistoryVersion[];
}

export function SetlistHistoryBrowser({ setlistId, canEdit, initialVersions }: Props) {
  const [versions, setVersions] = useState<HistoryVersion[]>(initialVersions);
  const [status, setStatus] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch(`/api/setlists/${setlistId}/history`);
      if (res.ok) setVersions(await res.json());
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refresh();
  }, [setlistId]);

  async function restore(label: string) {
    setStatus(null);
    const res = await fetch(`/api/setlists/${setlistId}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: label }),
    });
    if (res.ok) {
      setStatus(`Restored version ${label}`);
      window.location.reload();
    } else {
      setStatus("Restore failed");
    }
  }

  async function saveNewDate(copy: boolean) {
    const date = window.prompt("New date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!date) return;
    const res = await fetch(`/api/setlists/${setlistId}/history/new-date`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, copy }),
    });
    if (res.ok) {
      setStatus(`Saved new date ${date}`);
      await refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus(data?.error || "Failed");
    }
  }

  return (
    <section className="mt-8 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Version history</h2>
        {canEdit && (
          <div className="flex gap-2">
            <button type="button" onClick={() => saveNewDate(true)} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">New date (copy)</button>
            <button type="button" onClick={() => saveNewDate(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">New date (empty)</button>
          </div>
        )}
      </div>
      {versions.length === 0 ? (
        <p className="text-sm text-neutral-500">No archived versions yet.</p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.label} className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
              <div>
                <div className="font-medium">{v.title || v.label}</div>
                <div className="text-xs text-neutral-500">{v.label}{v.date ? ` • ${v.date}` : ""}</div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => restore(v.label)}
                  className="rounded border px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {status && <p className="mt-3 text-sm text-neutral-500">{status}</p>}
    </section>
  );
}
