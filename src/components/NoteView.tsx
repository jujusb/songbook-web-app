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
  getNestedValue,
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
  const [editing, setEditing] = useState(false);
  const [overrideText, setOverrideText] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [tabbed, setTabbed] = useState<Array<{ title: string; text: string }> | null>(null);
  const [activeTab, setActiveTab] = useState(0);
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
    let tabsCandidate: Array<{ title: string; text: string }> | null = null;
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
        const resolved = getNestedValue(payload.data, section.resultSection);
        const items = Array.isArray(resolved)
          ? resolved
          : Array.isArray(payload.data)
            ? payload.data
            : null;
        const candidate = items && items.length > 1 && items.every((m: unknown) => m && typeof m === "object")
          ? (() => {
              const first = items[0] as Record<string, unknown>;
              const listProp = Object.keys(first).find((k: string) => {
                const val = first[k];
                return Array.isArray(val) && (val as unknown[]).length > 0 && (val as unknown[]).every((x: unknown) => x && typeof x === "object");
              });
              return listProp ? { listProp, items } : null;
            })()
          : null;
        if (candidate) {
          tabsCandidate = candidate.items.map((group: unknown, idx: number) => {
            const m = group as Record<string, unknown>;
            const titleProp = (["titre", "title", "name", "label", "heading"] as string[]).find((k: string) => typeof m[k] === "string") ||
              Object.keys(m).find((k: string) => typeof m[k] === "string" && !Array.isArray(m[k]));
            const title = String(titleProp ? m[titleProp] : `Tab ${idx + 1}`);
            const lectures = (m[candidate.listProp] as unknown[]) || [];
            const texts = lectures
              .map((lec: unknown) => extractApiSectionText({ ...section, resultSection: undefined }, lec))
              .filter(Boolean);
            return { title, text: texts.join("\n\n") };
          });
        } else {
          chunks.push(extractApiSectionText(section, payload.data));
        }
      } catch (err) {
        chunks.push(
          `[${section.name || "api"}] ${err instanceof Error ? err.message : "error"}`
        );
      }
    }
    if (cancelled) return;
    setTabbed(tabsCandidate && tabsCandidate.length > 1 ? tabsCandidate : null);
    setActiveTab(0);
    setPreviewText(chunks.filter(Boolean).join("\n\n"));
    setPreviewLoading(false);
  };
    load();
    return () => {
      cancelled = true;
    };
  }, [note, selectedDate]);

  useEffect(() => {
    if (!note) return;
    setOverrideText(note.periodOverrides?.[selectedDate] || "");
  }, [note, selectedDate]);

  const handleSaveOverride = async () => {
    if (!note) return;
    setSaving(true);
    try {
      const next = { ...(note.periodOverrides || {}), [selectedDate]: overrideText };
      const updated = await notesApi.updateNote(noteId, { periodOverrides: next });
      setNote(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

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
        {note.published ? " • published" : " • private"}
        {note.publishedDates && note.publishedDates.length ? ` (dates: ${note.publishedDates.join(", ")})` : ""}
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

      {note?.periodic_behavior === "different_per_period" && (
        <div className="space-y-2">
          {editing ? (
            <>
              <textarea
                value={overrideText}
                onChange={(e) => setOverrideText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border rounded-md text-sm resize-y"
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveOverride} disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50">
                  {saving ? "Saving..." : "Save override"}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm border rounded-md">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="px-3 py-1.5 text-sm border rounded-md">
              Edit text for this date
            </button>
          )}
        </div>
      )}

      {previewLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : previewError ? (
        <p className="text-sm text-red-600">{previewError}</p>
      ) : tabbed ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 border-b border-neutral-200 dark:border-neutral-700">
            {tabbed.map((tab, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`px-3 py-2 text-sm border-b-2 ${activeTab === i ? "border-blue-600 text-blue-600" : "border-transparent text-neutral-500"}`}
              >
                {tab.title}
              </button>
            ))}
          </div>
          <MarkdownView text={tabbed[activeTab]?.text || ""} />
        </div>
      ) : (
        <MarkdownView text={previewText} />
      )}
    </div>
  );
}