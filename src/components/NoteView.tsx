"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MarkdownView } from "@/components/MarkdownView";
import { useTranslation } from "@/lib/i18n";
import { AutoScrollControl } from "@/components/AutoScrollControl";
import { notesApi, NoteMetadata, noteManualSectionKey, resolveNoteLanguage, type NoteManualPeriod } from "@/lib/notes";
import { RecurrentDateSelect } from "@/components/RecurrentDateSelect";

interface NoteViewProps {
  noteId: string;
  autoScrollSpeed?: number;
  initialDate?: string;
}

export function NoteView({ noteId, autoScrollSpeed, initialDate }: NoteViewProps) {
  const router = useRouter();
  const { locale } = useTranslation();
  const [note, setNote] = useState<NoteMetadata | null>(null);
  const noteApiSections = note ? (note.sections || note.content || []).filter((s) => s.type === "api") : [];
  const noteApplicableLanguages =
    noteApiSections.length > 0 && noteApiSections.every((s) => (s.languages?.length ?? 0) > 0)
      ? Array.from(new Set(noteApiSections.flatMap((s) => s.languages || [])))
      : [];
  const effectiveLanguage = note
    ? resolveNoteLanguage(note.language, noteApplicableLanguages, locale)
    : undefined;
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDateState] = useState(
    initialDate ?? new Date().toISOString().slice(0, 10)
  );
  // Keep the date in the URL (?date=) so it survives reloads and shows in the tab title.
  const setSelectedDate = (next: string) => {
    setSelectedDateState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("date", next);
    window.history.replaceState(null, "", url.toString());
  };
  const [manualPeriodState, setManualPeriodState] = useState<{
    date: string;
    content: NoteManualPeriod | null;
  } | null>(null);
  const manualPeriod =
    manualPeriodState?.date === selectedDate ? manualPeriodState.content : null;
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
    fetch(`/api/notes/${encodeURIComponent(noteId)}/manual?date=${encodeURIComponent(selectedDate)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setManualPeriodState({ date: selectedDate, content: data?.content ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) setManualPeriodState({ date: selectedDate, content: null });
      });
    return () => {
      cancelled = true;
    };
  }, [note, noteId, selectedDate]);

  useEffect(() => {
    if (!note) return;
    let cancelled = false;
  const load = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    const chunks: string[] = [];
    let tabsCandidate: Array<{ title: string; text: string }> | null = null;
    let legacyOverrideUsed = false;
    for (const [sectionIndex, section] of (note.sections || note.content || []).entries()) {
      if (section.type === "manual") {
        const periodSection = manualPeriod?.sections[noteManualSectionKey(section, sectionIndex)];
        const legacyOverride = manualPeriod ? undefined : note.periodOverrides?.[selectedDate];
        let manualMd: string | undefined;
        if (periodSection) {
          manualMd =
            (effectiveLanguage && periodSection.mdByLanguage?.[effectiveLanguage]) ||
            periodSection.md;
        } else if (legacyOverride && !legacyOverrideUsed) {
          legacyOverrideUsed = true;
          manualMd = legacyOverride;
        } else {
          manualMd =
            (effectiveLanguage && section.mdByLanguage?.[effectiveLanguage]) || section.md;
        }
        chunks.push(manualMd || "");
        continue;
      }
      if (!section.api_url) continue;
      const sectionLanguage =
        resolveNoteLanguage(note.language, section.languages, locale) || note.language;
      try {
        const res = await fetch(`/api/notes/${noteId}/preview/${sectionIndex}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lang: sectionLanguage,
            date: selectedDate,
          }),
        });
        const payload = (await res.json()) as {
          text?: string;
          tabs?: Array<{ title: string; text: string }>;
          error?: string;
        };
        if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
        if (payload.tabs?.length) {
          tabsCandidate = payload.tabs;
        } else if (payload.text) {
          chunks.push(payload.text);
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
  }, [note, selectedDate, effectiveLanguage, locale, noteId, manualPeriod]);

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
          {note.sections.some(
            (section) =>
              section.type === "manual" &&
              (section.periodic_behavior ?? note.periodic_behavior) === "different_per_period",
          ) && (
            <Link
              href={`/notes/${noteId}/manual?date=${encodeURIComponent(selectedDate)}`}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Edit manual text
            </Link>
          )}
          <button type="button" onClick={() => router.push(`/notes/${noteId}/edit`)} className="px-3 py-1.5 text-sm border rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">Edit</button>
          <button type="button" onClick={handleDelete} className="px-3 py-1.5 text-sm border rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950">Delete</button>
        </div>
      </div>
      <p className="text-sm text-neutral-500">
        {(effectiveLanguage || note.language)} • {note.recurrent_type} • {note.periodic_behavior}
        {note.published ? " • published" : " • private"}
        {note.publishedDates && note.publishedDates.length ? ` (dates: ${note.publishedDates.join(", ")})` : ""}
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <RecurrentDateSelect note={note} value={selectedDate} onChange={setSelectedDate} />
      </div>

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
      <AutoScrollControl initialSpeed={autoScrollSpeed} />
    </div>
  );
}