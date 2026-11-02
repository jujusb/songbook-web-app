"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownView } from "@/components/MarkdownView";
import {
  notesApi,
  NoteMetadata,
  NoteSection,
  interpolateApiUrl,
  extractApiSectionText,
} from "@/lib/notes";

interface NoteViewProps {
  noteId: string;
}

export function NoteView({ noteId }: NoteViewProps) {
  const router = useRouter();
  const [note, setNote] = useState<NoteMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [previewText, setPreviewText] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    notesApi.fetchNote(noteId).then((n) => {
      if (cancelled) return;
      setNote(n);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  useEffect(() => {
    if (!note) return;
    let cancelled = false;
    const load = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      const chunks: string[] = [];
      for (const section of note.sections || note.content || []) {
        if (section.type === "manual") {
          chunks.push(section.md || "");
          continue;
        }
        if (!section.api_url) continue;
        try {
          const url = interpolateApiUrl(section.api_url, {
            lang: note.language,
            date: selectedDate,
          });
          const res = await fetch("/api/notes/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, authorization: section.authorization }),
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
          chunks.push(extractApiSectionText(section, payload.data));
        } catch (err) {
          chunks.push(
            `[${section.name || "api"}] ${err instanceof Error ? err.message : "error"}`
          );
        }
      }
      if (cancelled) return;
      setPreviewText(chunks.filter(Boolean).join("\n\n"));
      setPreviewLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [note, selectedDate]);

  const handleDelete = async () => {
    if (!confirm("Delete this note?")) return;
    await notesApi.deleteNote(noteId);
    router.push("/notes");
  };

  if (loading) {
    return <div className="p-6">Loading note…</div>;
  }
  if (!note) {
    return <div className="p-6">Note not found</div>;
  }

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{note.title}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push(`/notes/${noteId}/edit`)} className="px-3 py-1.5 text-sm border rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">Edit</button>
          <button type="button" onClick={handleDelete} className="px-3 py-1.5 text-sm border rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950">Delete</button>
        </div>
      </div>
      <p className="text-sm text-neutral-500">
        {note.language} • {note.recurrent_type} • {note.periodic_behavior}
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm"
        />
      </div>

      {previewLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : previewError ? (
        <p className="text-sm text-red-600">{previewError}</p>
      ) : (
        <MarkdownView text={previewText} />
      )}
    </div>
  );
}