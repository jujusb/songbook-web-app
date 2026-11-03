"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface HistoryVersion {
  label: string;
  path: string;
  title: string;
  date?: string;
  description?: string;
}

interface Props {
  setlistId: string;
  canEdit: boolean;
  initialVersions: HistoryVersion[];
  currentVersion: string | null;
}

export function SetlistHistoryBrowser({ setlistId, canEdit, initialVersions, currentVersion }: Props) {
  const router = useRouter();
  const [versions, setVersions] = useState<HistoryVersion[]>(initialVersions);
  const [selected, setSelected] = useState<string>(currentVersion || (initialVersions[0]?.label ?? ""));
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
      router.push(`/setlists/${setlistId}`);
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
            <button type="button" onClick={() => selected && restore(selected)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">Restore selected</button>
            <button type="button" onClick={() => saveNewDate(true)} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">New date (copy)</button>
            <button type="button" onClick={() => saveNewDate(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">New date (empty)</button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <select
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          value={selected}
          onChange={(e) => {
            const label = e.target.value;
            setSelected(label);
            if (label) router.push(`/setlists/${setlistId}?version=${encodeURIComponent(label)}`);
          }}
        >
          <option value="">Select version…</option>
          {versions.map((v) => (
            <option key={v.label} value={v.label}>
              {v.title || v.label}{v.date ? ` • ${v.date}` : ""}
            </option>
          ))}
        </select>
        {canEdit && (
          <div className="flex gap-2">
            <button type="button" onClick={() => saveNewDate(true)} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">New date (copy)</button>
            <button type="button" onClick={() => saveNewDate(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">New date (empty)</button>
          </div>
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
