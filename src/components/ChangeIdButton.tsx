"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { changeSongIdAction } from "@/app/actions";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ChangeIdButton({ songId, lang }: { songId: string; lang: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(songId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    const newId = slugify(value);
    if (!newId) {
      setError("ID cannot be empty");
      return;
    }
    if (newId === songId) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await changeSongIdAction(songId, newId);
      if (!result.ok) {
        setError(result.error === "READ_ONLY" ? "Read-only mode" : result.error);
        setBusy(false);
        return;
      }
      router.push(`/songs/${result.songId}?lang=${lang}`);
      router.refresh();
    } catch {
      setError("Failed to change ID");
      setBusy(false);
    }
  }, [value, songId, lang, router]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(songId);
          setEditing(true);
          setError(null);
        }}
        className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        title="Change the song ID (URL slug). Album and setlist references are updated automatically."
      >
        Change ID
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        disabled={busy}
        autoFocus
        placeholder="new-song-id"
        className="w-40 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={busy}
        className="text-sm px-3 py-1 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}