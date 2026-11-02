"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { notesApi, NoteMetadata, NoteSection, interpolateApiUrl, extractApiSectionText } from "@/lib/notes";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];
const RECURRENT_TYPES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "specific-dates", label: "Specific Dates" },
  { value: "daily", label: "Daily" },
];
const SCHEDULES = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "first", label: "First Sunday of Month" },
  { value: "first-second", label: "First & Second Sunday" },
  { value: "last", label: "Last of Month" },
];
const PERIODIC_BEHAVIORS = [
  { value: "same", label: "Same text every period" },
  { value: "different_per_period", label: "Different text per period" },
];

interface SectionPreview {
  loading?: boolean;
  error?: string | null;
  data?: unknown;
  extracted?: string;
}

interface NoteFormProps {
  initialNote?: NoteMetadata;
  isNew?: boolean;
  noteId?: string;
}

function emptySection(type: "manual" | "api"): NoteSection {
  if (type === "manual") return { type: "manual", md: "" };
  return { type: "api", name: "custom-api", api_url: "", resultSection: "", authorization: "", typeStyles: undefined };
}

export function NoteForm({ initialNote, isNew = true, noteId }: NoteFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(!isNew && !!noteId && !initialNote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  const [title, setTitle] = useState(initialNote?.title ?? "");
  const [language, setLanguage] = useState(initialNote?.language ?? "en");
  const [recurrentType, setRecurrentType] = useState(initialNote?.recurrent_type ?? "weekly");
  const [recurrentSchedule, setRecurrentSchedule] = useState(initialNote?.recurrent_schedule ?? "sunday");
  const [periodicBehavior, setPeriodicBehavior] = useState(initialNote?.periodic_behavior ?? "same");
  const [tags, setTags] = useState(initialNote?.tags ? initialNote.tags.join(", ") : "");
  const [exampleDate, setExampleDate] = useState(new Date().toISOString().slice(0, 10));
  const [sections, setSections] = useState<NoteSection[]>(
    initialNote?.sections?.length
      ? initialNote.sections
      : initialNote?.content?.length
        ? initialNote.content
        : [{ type: "manual", md: "" } as NoteSection]
  );
  const [sectionStylesText, setSectionStylesText] = useState<string[]>(
    (initialNote?.sections?.length ? initialNote.sections : initialNote?.content?.length ? initialNote.content : [{ type: "manual", md: "" } as NoteSection]).map(
      (s) => (s.typeStyles ? JSON.stringify(s.typeStyles, null, 2) : "")
    )
  );
  const [previews, setPreviews] = useState<Record<number, SectionPreview>>({});

  useEffect(() => {
    if (!isNew && noteId && !initialNote) {
      notesApi.fetchNote(noteId).then((n) => {
        if (!n) { setNotFoundFlag(true); setIsLoading(false); return; }
        setTitle(n.title);
        setLanguage(n.language);
        setRecurrentType(n.recurrent_type);
        setRecurrentSchedule(n.recurrent_schedule);
        setPeriodicBehavior(n.periodic_behavior);
        setTags(n.tags ? n.tags.join(", ") : "");
        const secs = n.sections?.length ? n.sections : n.content?.length ? n.content : [{ type: "manual", md: "" } as NoteSection];
        setSections(secs);
        setSectionStylesText(secs.map((s) => (s.typeStyles ? JSON.stringify(s.typeStyles, null, 2) : "")));
        setIsLoading(false);
      });
    }
  }, [isNew, noteId, initialNote]);

  const isEdit = !isNew;

  const updateSection = useCallback((index: number, patch: Partial<NoteSection>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, []);

  const updateStylesText = useCallback((index: number, value: string) => {
    setSectionStylesText((prev) => prev.map((v, i) => (i === index ? value : v)));
  }, []);

  const addSection = useCallback((type: "manual" | "api") => {
    setSections((prev) => [...prev, emptySection(type)]);
    setSectionStylesText((prev) => [...prev, ""]);
  }, []);

  const removeSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
    setSectionStylesText((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveSection = useCallback((index: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    setSectionStylesText((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }, []);

  const handlePreview = useCallback(async (index: number) => {
    const section = sections[index];
    if (!section || section.type !== "api" || !section.api_url?.trim()) {
      setPreviews((p) => ({ ...p, [index]: { error: "API endpoint is required" } }));
      return;
    }
    setPreviews((p) => ({ ...p, [index]: { loading: true, error: null } }));
    try {
      const url = interpolateApiUrl(section.api_url.trim(), { lang: language, date: exampleDate });
      const res = await fetch("/api/notes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, authorization: section.authorization }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const payload = await res.json();
      const data = payload.data;
      let typeStyles: Record<string, string> | undefined;
      const txt = sectionStylesText[index]?.trim();
      if (txt) { try { typeStyles = JSON.parse(txt); } catch { typeStyles = undefined; } }
      const extracted = extractApiSectionText({ ...section, typeStyles }, data);
      setPreviews((p) => ({ ...p, [index]: { loading: false, error: null, data, extracted } }));
    } catch (err) {
      setPreviews((p) => ({ ...p, [index]: { loading: false, error: err instanceof Error ? err.message : "Preview failed" } }));
    }
  }, [sections, language, exampleDate, sectionStylesText]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const builtSections: NoteSection[] = sections.map((s, i) => {
        if (s.type === "manual") return { type: "manual", md: s.md || "", periodic_behavior: s.periodic_behavior || "same" };
        let typeStyles: Record<string, string> | undefined;
        const txt = sectionStylesText[i]?.trim();
        if (txt) { try { typeStyles = JSON.parse(txt); } catch { typeStyles = undefined; } }
        return {
          type: "api",
          name: s.name || "custom-api",
          api_url: (s.api_url || "").trim(),
          resultSection: (s.resultSection || "").trim(),
          authorization: s.authorization,
          languages: s.languages,
          typeStyles,
        };
      });
      if (builtSections.length === 0) builtSections.push({ type: "manual", md: "" });

      const note: NoteMetadata = {
        id: isEdit ? (noteId ?? `note-${Date.now()}`) : `note-${Date.now()}`,
        title: title.trim(),
        language,
        recurrent_type: recurrentType,
        recurrent_schedule: recurrentSchedule,
        periodic_behavior: periodicBehavior,
        api_source: builtSections.some((s) => s.type === "api") ? "api" : "manual",
        api_sources: builtSections
          .filter((s): s is NoteSection & { type: "api" } => s.type === "api")
          .map((s) => ({
            name: s.name || "custom-api",
            api_url: s.api_url || "",
            resultSection: s.resultSection,
            authorization: s.authorization,
            languages: s.languages,
          })),
        last_fetched: isEdit ? "" : new Date().toISOString(),
        last_edited: new Date().toISOString(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        sections: builtSections,
        content: builtSections,
        created: isEdit ? "" : new Date().toISOString(),
      };
      if (isEdit) {
        await notesApi.updateNote(noteId!, note);
        router.push(`/notes/${noteId}/edit`);
      } else {
        const created = await notesApi.createNote(note);
        router.push(`/notes/${created.id}/edit`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }, [title, language, recurrentType, recurrentSchedule, periodicBehavior, tags, sections, sectionStylesText, isEdit, noteId, router]);

  if (notFoundFlag) notFound();
  if (isLoading) return <div className="p-6 max-w-2xl"><p className="text-sm text-neutral-500">Loading note…</p></div>;

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? "Edit Note" : "New Recurrent Note"}</h1>
      {error && <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">{error}</div>}
      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Recurrent type</label>
            <select value={recurrentType} onChange={(e) => setRecurrentType(e.target.value as "weekly" | "monthly" | "specific-dates" | "daily")} className="w-full px-3 py-2 border rounded-md text-sm">
              {RECURRENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Recurrent schedule</label>
            <select value={recurrentSchedule} onChange={(e) => setRecurrentSchedule(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
              {SCHEDULES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Periodic behavior</label>
            <select value={periodicBehavior} onChange={(e) => setPeriodicBehavior(e.target.value as "same" | "different_per_period")} className="w-full px-3 py-2 border rounded-md text-sm">
              {PERIODIC_BEHAVIORS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="gospel, lectionary, weekly" className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
      </div>

      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Note sections</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => addSection("manual")} className="px-3 py-1.5 text-sm border rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">+ Manual</button>
            <button type="button" onClick={() => addSection("api")} className="px-3 py-1.5 text-sm border rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">+ External API</button>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mb-4">
          A note is an ordered list of parts. Each part is either manual text or a call to an external API.
          Use {"${LANG}"}/$LANG for the language and $DATE/$DATE(format) for the date in API URLs.
        </p>

        <div className="space-y-4">
          {exampleDate && null}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Example date for previews</label>
            <input type="date" value={exampleDate} onChange={(e) => setExampleDate(e.target.value)} className="px-3 py-2 border rounded-md text-sm" />
          </div>
          {sections.map((section, index) => (
            <div key={index} className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <select
                  value={section.type}
                  onChange={(e) => {
                    const newType = e.target.value as "manual" | "api";
                    updateSection(index, emptySection(newType));
                  }}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="manual">Manual text</option>
                  <option value="api">External API</option>
                </select>
                <div className="flex gap-2">
                  <button type="button" onClick={() => moveSection(index, -1)} className="px-2 py-1 text-xs border rounded">↑</button>
                  <button type="button" onClick={() => moveSection(index, 1)} className="px-2 py-1 text-xs border rounded">↓</button>
                  <button type="button" onClick={() => removeSection(index)} className="px-2 py-1 text-xs border rounded text-red-600">Remove</button>
                </div>
              </div>

              {section.type === "manual" ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Periodic behavior</label>
                    <select
                      value={section.periodic_behavior || "same"}
                      onChange={(e) => updateSection(index, { periodic_behavior: e.target.value as "same" | "different_per_period" })}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="same">Same text every period</option>
                      <option value="different_per_period">Different text per period</option>
                    </select>
                  </div>
                  <textarea
                    value={section.md || ""}
                    onChange={(e) => updateSection(index, { md: e.target.value })}
                    rows={6}
                    placeholder="Text in Markdown..."
                    className="w-full px-3 py-2 border rounded-md text-sm resize-y"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">API endpoint</label>
                    <input
                      type="url"
                      value={section.api_url || ""}
                      onChange={(e) => updateSection(index, { api_url: e.target.value })}
                      placeholder="https://api.example.com/endpoint?lang=${LANG}&date=$DATE(YYYY-MM-DD)"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Result section / path</label>
                    <input
                      type="text"
                      value={section.resultSection || ""}
                      onChange={(e) => updateSection(index, { resultSection: e.target.value })}
                      placeholder="e.g. text / messes.lectures[]"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Authorization (optional)</label>
                    <input
                      type="text"
                      value={section.authorization || ""}
                      onChange={(e) => updateSection(index, { authorization: e.target.value })}
                      placeholder="Bearer token"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type → style map (JSON, optional)</label>
                    <textarea
                      value={sectionStylesText[index] || ""}
                      onChange={(e) => updateStylesText(index, e.target.value)}
                      rows={3}
                      placeholder='{"title":"h2","heading":"h2","subtitle":"h3"}'
                      className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePreview(index)}
                    disabled={previews[index]?.loading}
                    className="px-4 py-2 bg-neutral-700 text-white rounded-md text-sm hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {previews[index]?.loading ? "Loading..." : "Preview API data"}
                  </button>
                  {previews[index]?.error && (
                    <p className="text-sm text-red-600 dark:text-red-400">{previews[index]?.error}</p>
                  )}
                  {previews[index]?.extracted && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Extracted text</label>
                      <pre className="whitespace-pre-wrap text-sm border rounded-md p-2">{previews[index]?.extracted}</pre>
                    </div>
                  )}
                  {previews[index]?.data !== undefined && previews[index]?.data !== null && (
                    <details>
                      <summary className="text-sm cursor-pointer text-neutral-600 dark:text-neutral-400">Raw JSON</summary>
                      <pre className="text-xs overflow-auto max-h-64 mt-1">{JSON.stringify(previews[index]?.data, null, 2)}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          ))}
          {sections.length === 0 && (
            <p className="text-sm text-neutral-500">No sections. Add a part using the buttons above.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <button type="button" onClick={handleSave} disabled={saving || !title.trim()} className="px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving…" : isEdit ? "Save Note" : "Create Note"}
        </button>
        <button type="button" onClick={() => router.push("/notes")} className="px-4 py-2.5 border rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
          Cancel
        </button>
      </div>
    </div>
  );
}