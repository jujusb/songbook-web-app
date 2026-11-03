"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { notesApi, NoteMetadata, NoteSection, interpolateApiUrl, extractApiSectionText, getApiResultKeys, getNestedValue } from "@/lib/notes";

const LANGUAGES = [
  { value: "en-US", label: "English" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
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

function normalizeTypeValue(value: unknown): string {
  return String(value ?? "").replace(/_\d+$/, "");
}

function hasFieldValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

/** Flatten a preview payload the same way the discriminator preview does. */
function collectDiscriminatedObjects(data: unknown, resultSection?: string): any[] {
  const source = getNestedValue(data, resultSection);
  const top = Array.isArray(source) ? source : source ? [source] : [];
  const objs: any[] = [];
  for (const item of top) {
    if (!item || typeof item !== "object") continue;
    const listProp = Object.keys(item).find((k) => Array.isArray((item as any)[k]) && (item as any)[k].some((x: any) => x && typeof x === "object"));
    if (listProp) {
      for (const child of (item as any)[listProp]) if (child && typeof child === "object") objs.push(child);
    } else {
      objs.push(item);
    }
  }
  return objs;
}

/**
 * Rebuild the editor-only state of an API section from the persisted config
 * (discriminatorValues[].fieldsOrdered / fields), so the field mapping UI is
 * populated on edit even before a preview is fetched.
 */
function hydrateSection(sec: NoteSection): NoteSection {
  if (sec.type !== "api") return sec;
  const dvs = (sec.discriminatorValues || []) as any[];
  const dvFieldNames = Array.from(new Set(dvs.flatMap((dv) => (dv.fieldsOrdered || dv.fields || []).map((f: any) => f.name as string))));
  const savedFieldNames = (sec.fields || []).map((f) => f.name);
  const fieldNames = dvFieldNames.length ? dvFieldNames : savedFieldNames;
  return {
    ...sec,
    typeStyles: sec.typeStyles || (dvs.length ? Object.fromEntries(dvs.map((dv) => [dv.name, dv.style || "plain"])) : undefined),
    typeConfigs: sec.typeConfigs || (dvs.length
      ? Object.fromEntries(dvs.map((dv) => [dv.name, {
          fieldOrder: (dv.fieldsOrdered || []).map((f: any) => f.name),
          fieldStyles: Object.fromEntries((dv.fieldsOrdered || []).map((f: any) => [f.name, f.style || "plain"])),
          showDiscriminator: sec.showDiscriminator,
        }]))
      : undefined),
    allFields: sec.allFields?.length ? sec.allFields : (fieldNames.length ? fieldNames : undefined),
    fieldOrder: sec.fieldOrder?.length ? sec.fieldOrder : (fieldNames.length ? fieldNames : undefined),
    fieldStyles: sec.fieldStyles || (sec.fields ? Object.fromEntries(sec.fields.map((f: any) => [f.name, f.style || "plain"])) : undefined),
    rawDiscriminatorValues: sec.rawDiscriminatorValues?.length ? sec.rawDiscriminatorValues : dvs.map((dv) => dv.name as string),
  } as NoteSection;
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
  const [language, setLanguage] = useState(initialNote?.language ?? "en-US");
  const [recurrentType, setRecurrentType] = useState(initialNote?.recurrent_type ?? "weekly");
  const [recurrentSchedule, setRecurrentSchedule] = useState(initialNote?.recurrent_schedule ?? "sunday");
  const [periodicBehavior, setPeriodicBehavior] = useState(initialNote?.periodic_behavior ?? "same");
  const [tags, setTags] = useState(initialNote?.tags ? initialNote.tags.join(", ") : "");
  const [publishMode, setPublishMode] = useState<"private" | "all" | "dates">(
    initialNote?.published ? "all" : (initialNote?.publishedDates && initialNote.publishedDates.length ? "dates" : "private")
  );
  const [publishedDates, setPublishedDates] = useState(
    initialNote?.publishedDates ? initialNote.publishedDates.join(", ") : ""
  );
  const [exampleDate, setExampleDate] = useState(new Date().toISOString().slice(0, 10));
  const [sections, setSections] = useState<NoteSection[]>(
    (initialNote?.sections?.length ? initialNote.sections : initialNote?.content?.length ? initialNote.content : [{ type: "manual", md: "" } as NoteSection]).map(hydrateSection)
  );
  const [previews, setPreviews] = useState<Record<number, SectionPreview>>({});
  const [activeTypeTab, setActiveTypeTab] = useState<Record<number, string>>({});

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
        setPublishMode(n.published ? "all" : (n.publishedDates && n.publishedDates.length ? "dates" : "private"));
        setPublishedDates(n.publishedDates ? n.publishedDates.join(", ") : "");
        const secs = n.sections?.length ? n.sections : n.content?.length ? n.content : [{ type: "manual", md: "" } as NoteSection];
        setSections(secs.map(hydrateSection));
        setIsLoading(false);
      });
    }
  }, [isNew, noteId, initialNote]);

  const isEdit = !isNew;

  const updateSection = useCallback((index: number, patch: Partial<NoteSection>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, []);

  const addSection = useCallback((type: "manual" | "api") => {
    setSections((prev) => [...prev, emptySection(type)]);
  }, []);

  const removeSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveSection = useCallback((index: number, dir: -1 | 1) => {
    setSections((prev) => {
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
      const extracted = extractApiSectionText(section, data);
      // Persist result keys and discriminator values so mapping survives re-edit.
      const source = getNestedValue(data, section.resultSection);
      const top = Array.isArray(source) ? source : source ? [source] : [];
      const objs: any[] = [];
      for (const item of top) {
        if (!item || typeof item !== "object") continue;
        const listProp = Object.keys(item).find((k) => Array.isArray((item as any)[k]) && (item as any)[k].some((x: any) => x && typeof x === "object"));
        if (listProp) {
          for (const child of (item as any)[listProp]) if (child && typeof child === "object") objs.push(child);
        } else {
          objs.push(item);
        }
      }
      const discField = section.discriminator || (Array.isArray(section.allFields) && section.allFields.includes("type") ? "type" : (section.allFields?.[0] || "type"));
      const rawVals = [...new Set(objs.map((o) => String(o?.[discField] ?? "")).filter((v) => v !== ""))] ;
      const vals = [...new Set(rawVals.map((v) => v.replace(/_\d+$/, "")))];
      const allFields = getApiResultKeys(data, section.resultSection);
      updateSection(index, {
        allFields,
        rawDiscriminatorValues: rawVals,
        typeStyles: { ...(section.typeStyles || {}), ...Object.fromEntries(vals.map((v) => [v, section.typeStyles?.[v] || "plain"])) },
        discriminatorValues: vals.map((v) => ({ name: v, style: section.typeStyles?.[v] || "plain" })),
      });
      setPreviews((p) => ({ ...p, [index]: { loading: false, error: null, data, extracted } }));
    } catch (err) {
      setPreviews((p) => ({ ...p, [index]: { loading: false, error: err instanceof Error ? err.message : "Preview failed" } }));
    }
  }, [sections, language, exampleDate]);

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
        const disc = s.discriminator || (Array.isArray(s.allFields) && s.allFields.includes("type") ? "type" : (s.allFields?.[0] || "type"));
        const keys = Array.isArray(s.fieldOrder) && s.fieldOrder.length
          ? s.fieldOrder
          : (Array.isArray(s.allFields) ? s.allFields : []);
        if (disc === "none") {
          return {
            type: "api",
            name: s.name || "custom-api",
            api_url: (s.api_url || "").trim(),
            resultSection: (s.resultSection || "").trim(),
            authorization: s.authorization,
            languages: s.languages,
            discriminator: "none",
            showDiscriminator: s.showDiscriminator,
            fields: keys.map((k) => ({ name: k, style: s.fieldStyles?.[k] || "plain" })),
          };
        }
        const baseValues = Array.from(new Set(Object.keys(s.typeStyles || {})));
        // Only keep fields that have a value in the previewed API data for this type.
        // Without a preview there is no data to check, so all configured fields are kept.
        const previewObjs = previews[i]?.data !== undefined ? collectDiscriminatedObjects(previews[i]?.data, s.resultSection) : null;
        const discriminatorValues = baseValues.map((base) => {
          const cfg = s.typeConfigs?.[base] || {};
          const cfgKeys = Array.isArray(cfg.fieldOrder) && cfg.fieldOrder.length ? cfg.fieldOrder : keys;
          const savedKeys = previewObjs
            ? cfgKeys.filter((k) => previewObjs.some((o) => normalizeTypeValue(o?.[disc]) === base && hasFieldValue(o?.[k])))
            : cfgKeys;
          return {
            name: base,
            style: s.typeStyles?.[base] || "plain",
            fieldsOrdered: savedKeys.map((k) => ({
              name: k,
              style: cfg.fieldStyles?.[k] || s.fieldStyles?.[k] || "plain",
            })),
          };
        });
        return {
          type: "api",
          name: s.name || "custom-api",
          api_url: (s.api_url || "").trim(),
          resultSection: (s.resultSection || "").trim(),
          authorization: s.authorization,
          languages: s.languages,
          discriminator: disc,
          showDiscriminator: s.showDiscriminator,
          discriminatorValues,
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
        published: publishMode === "all",
        publishedDates: publishMode === "dates"
          ? publishedDates.split(",").map((d) => d.trim()).filter(Boolean)
          : [],
        sections: builtSections,
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
  }, [title, language, recurrentType, recurrentSchedule, periodicBehavior, tags, publishMode, publishedDates, sections, previews, isEdit, noteId, router]);

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
        <div>
          <label className="block text-sm font-medium mb-1">Publish to other users</label>
          <select value={publishMode} onChange={(e) => setPublishMode(e.target.value as "private" | "all" | "dates")} className="w-full px-3 py-2 border rounded-md text-sm">
            <option value="private">Private (default)</option>
            <option value="all">Published entirely</option>
            <option value="dates">Published only on specific dates</option>
          </select>
        </div>
        {publishMode === "dates" && (
          <div>
            <label className="block text-sm font-medium mb-1">Published dates (comma-separated, YYYY-MM-DD)</label>
            <input type="text" value={publishedDates} onChange={(e) => setPublishedDates(e.target.value)} placeholder="2026-11-08, 2026-11-15" className="w-full px-3 py-2 border rounded-md text-sm" />
          </div>
        )}
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
                  {(() => {
                    const previewKeys = getApiResultKeys(previews[index]?.data, section.resultSection);
                    const keys = previewKeys.length
                      ? previewKeys
                      : (Array.isArray(section.allFields) && section.allFields.length
                          ? section.allFields
                          : (Array.isArray(section.fieldOrder) ? section.fieldOrder : []));
                    if (!keys.length) return null;
                    const order = Array.isArray(section.fieldOrder) && section.fieldOrder.length ? section.fieldOrder : keys;
                    const disc = section.discriminator || (keys.includes("type") ? "type" : keys[0]);
                    return (
                      <div className="mt-3 space-y-2">
                        <label className="block text-sm font-medium">Field mapping (order, discriminator, style)</label>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm">Discriminator field</label>
                          <select
                            value={disc}
                            onChange={(e) => updateSection(index, { discriminator: e.target.value })}
                            className="px-2 py-1 border rounded text-sm"
                          >
                            <option value="none">none (no discriminator)</option>
                            {keys.map((k) => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </div>
                        {disc === "none" && (
                        <div className="space-y-2">
                          {order.filter((k) => keys.includes(k)).concat(keys.filter((k) => !order.includes(k))).map((key, pos, arr) => (
                            <div key={key} className="flex items-center gap-2 text-xs border rounded p-2">
                              <span className="font-mono min-w-24">{key}</span>
                              <select
                                value={section.fieldStyles?.[key] || "plain"}
                                onChange={(e) => updateSection(index, { fieldStyles: { ...(section.fieldStyles || {}), [key]: e.target.value } })}
                                className="px-2 py-1 border rounded"
                              >
                                <option value="plain">plain</option>
                                <option value="bold">bold</option>
                                <option value="italic">italic</option>
                                <option value="h2">h2</option>
                                <option value="h3">h3</option>
                                <option value="quote">quote</option>
                                <option value="code">code</option>
                                <option value="none">none (do not display)</option>
                              </select>
                              <button type="button" onClick={() => {
                                const next = [...arr];
                                if (pos <= 0) return;
                                [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
                                updateSection(index, { fieldOrder: next });
                              }} className="px-2 py-1 border rounded">↑</button>
                              <button type="button" onClick={() => {
                                const next = [...arr];
                                if (pos >= next.length - 1) return;
                                [next[pos + 1], next[pos]] = [next[pos], next[pos + 1]];
                                updateSection(index, { fieldOrder: next });
                              }} className="px-2 py-1 border rounded">↓</button>
                            </div>
                          ))}
                        </div>
                        )}
                        {!section.fieldOrder && disc === "none" && (
                          <button
                            type="button"
                            onClick={() => updateSection(index, { fieldOrder: keys, discriminator: keys.includes("type") ? "type" : keys[0] })}
                            className="text-xs px-2 py-1 border rounded"
                          >
                            Initialize mapping from preview
                          </button>
                        )}

                        {(() => {
                          const disc = section.discriminator || (keys.includes("type") ? "type" : keys[0]);
                          if (disc === "none") return null;
                          const preview = previews[index]?.data;
                          const source = preview ? getNestedValue(preview, section.resultSection) : null;
                          const top = Array.isArray(source) ? source : source ? [source] : [];
                          let previewObjs: any[] = [];
                          for (const item of top) {
                            if (!item || typeof item !== "object") continue;
                            const listProp = Object.keys(item).find((k) => Array.isArray((item as any)[k]) && (item as any)[k].some((x: any) => x && typeof x === "object"));
                            if (listProp) {
                              for (const child of (item as any)[listProp]) if (child && typeof child === "object") previewObjs.push(child);
                            } else {
                              previewObjs.push(item);
                            }
                          }
                          const previewValues = preview ? [...new Set(previewObjs.map((o) => String(o?.[disc] ?? "").replace(/_\d+$/, "")).filter((v) => v !== ""))] : [];
                          const values = previewValues.length
                            ? previewValues
                            : (Array.isArray(section.discriminatorValues) ? section.discriminatorValues.map((v: any) => typeof v === "string" ? v : v.name) : []);
                          if (!values.length || disc === "none") return null;
                          const order = values;
                          const sortedValues = order.filter((v) => values.includes(v)).concat(values.filter((v) => !order.includes(v)));
                          if (sortedValues.length <= 1) return null;
                          const rawSummaryValues = previewObjs.length
                            ? [...new Set(previewObjs.map((o) => String(o?.[disc] ?? "")).filter((v) => v !== ''))]
                            : (section.rawDiscriminatorValues || []);
                          return (
                            <div className="mt-3 space-y-1">
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={section.showDiscriminator === true}
                                  onChange={(e) => updateSection(index, { showDiscriminator: e.target.checked })}
                                />
                                Display discriminator field
                              </label>
                              {rawSummaryValues.length > 0 && (
                                <div className="space-y-1 mb-3">
                                  { rawSummaryValues.map((rawVal) => {
                                      const rawBase = String(rawVal).replace(/_\d+$/, "");
                                      return (
                                        <div key={rawVal} className="flex items-center gap-3 text-xs">
                                          <input
                                            type="checkbox"
                                            checked={(section.typeVisibility?.[rawBase] ?? true) && (section.typeStyles?.[rawBase] || "plain").toLowerCase() !== "none"}
                                            onChange={(e) => updateSection(index, {
                                              typeVisibility: { ...(section.typeVisibility || {}), [rawBase]: e.target.checked },
                                              ...( !e.target.checked ? { typeStyles: { ...(section.typeStyles || {}), [rawBase]: "none" } } : {} ),
                                            })}
                                          />
                                          <span className="font-mono min-w-24">{rawVal}</span>
                                          <span className="text-neutral-500 min-w-20">{rawBase}</span>
                                          <select
                                            value={section.typeStyles?.[rawBase] || "plain"}
                                            onChange={(e) => updateSection(index, { typeStyles: { ...(section.typeStyles || {}), [rawBase]: e.target.value } })}
                                            className="px-2 py-1 border rounded"
                                          >
                                            <option value="plain">plain</option>
                                            <option value="bold">bold</option>
                                            <option value="italic">italic</option>
                                            <option value="h2">h2</option>
                                            <option value="h3">h3</option>
                                            <option value="quote">quote</option>
                                            <option value="code">code</option>
                                            <option value="none">none (do not display)</option>
                                          </select>
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
                              <label className="block text-sm font-medium">Discriminator values (style and order)</label>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {sortedValues.map((val) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => setActiveTypeTab((prev) => ({ ...prev, [index]: val }))}
                                    className={`px-3 py-1.5 text-xs border rounded ${ (activeTypeTab[index] || sortedValues[0]) === val ? "bg-blue-600 text-white" : "bg-neutral-100 dark:bg-neutral-800" }`}
                                  >
                                    {val}
                                  </button>
                                ))}
                              </div>
                              {(() => {
                                const activeVal = activeTypeTab[index] || sortedValues[0];
                                const cfg = section.typeConfigs?.[activeVal] || {};
                                const previewData = previews[index]?.data;
                                const previewSource = getNestedValue(previewData, section.resultSection);
                                const previewTop = Array.isArray(previewSource) ? previewSource : previewSource ? [previewSource] : [];
                                const previewObjs: any[] = [];
                                for (const item of previewTop) {
                                  if (!item || typeof item !== 'object') continue;
                                  const listProp = Object.keys(item).find((k) => Array.isArray((item as any)[k]) && (item as any)[k].some((x: any) => x && typeof x === 'object'));
                                  if (listProp) {
                                    for (const child of (item as any)[listProp]) if (child && typeof child === 'object') previewObjs.push(child);
                                  } else {
                                    previewObjs.push(item);
                                  }
                                }
                                const valueObjs = previewObjs.filter((o) => String(o?.[disc]) === String(activeVal));
                                let valueKeys = [...new Set((valueObjs.length ? valueObjs : previewObjs).flatMap((o) => Object.keys(o || {})))]
                                  .filter((k) => (valueObjs.length ? valueObjs : previewObjs).some((o) => o?.[k] !== null && o?.[k] !== undefined && o?.[k] !== ""))
                                  .filter((k) => k !== disc || section.showDiscriminator === true);
                                if (!valueKeys.length && Array.isArray(section.allFields)) {
                                  valueKeys = section.allFields.filter((k) => k !== disc || section.showDiscriminator === true);
                                }
                                if (!valueKeys.length && Array.isArray(section.fieldOrder)) {
                                  valueKeys = section.fieldOrder.filter((k) => k !== disc || section.showDiscriminator === true);
                                }
                                const activeKeys = Array.isArray(cfg.fieldOrder) && cfg.fieldOrder.length ? cfg.fieldOrder : (Array.isArray(section.fieldOrder) && section.fieldOrder.length ? section.fieldOrder : valueKeys.length ? valueKeys : keys);
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium">{activeVal} style</span>
                                      <select
                                        value={section.typeStyles?.[activeVal] || "plain"}
                                        onChange={(e) => updateSection(index, { typeStyles: { ...(section.typeStyles || {}), [activeVal]: e.target.value } })}
                                        className="px-2 py-1 border rounded text-xs"
                                      >
                                        <option value="plain">plain</option>
                                        <option value="bold">bold</option>
                                        <option value="italic">italic</option>
                                        <option value="h2">h2</option>
                                        <option value="h3">h3</option>
                                        <option value="quote">quote</option>
                                        <option value="code">code</option>
                                        <option value="none">none (do not display)</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      {(Array.isArray(cfg.fieldOrder) && cfg.fieldOrder.length
                                        ? activeKeys
                                        : activeKeys.filter((k) => valueKeys.includes(k)).concat(valueKeys.filter((k) => !activeKeys.includes(k)))
                                      ).map((key, pos, arr) => {
                                        const fieldStyle = (cfg.fieldStyles as Record<string, string> | undefined)?.[key] || (section.fieldStyles || {})[key] || "plain";
                                        return (
                                          <div key={key} className="flex items-center gap-2 text-xs border rounded p-2">
                                            <span className="font-mono min-w-24">{key}</span>
                                            <select
                                              value={fieldStyle}
                                              onChange={(e) => {
                                                const nextCfg = { ...(section.typeConfigs || {}) };
                                                const current = (nextCfg[activeVal] as Record<string, unknown> | undefined) || {};
                                                nextCfg[activeVal] = {
                                                  ...current,
                                                  fieldOrder: Array.isArray(current.fieldOrder) && (current.fieldOrder as string[]).length ? current.fieldOrder : activeKeys,
                                                  fieldStyles: { ...((current.fieldStyles as Record<string, string> | undefined) || {}), [key]: e.target.value },
                                                };
                                                updateSection(index, { typeConfigs: nextCfg });
                                              }}
                                              className="px-2 py-1 border rounded"
                                            >
                                              <option value="plain">plain</option>
                                              <option value="bold">bold</option>
                                              <option value="italic">italic</option>
                                              <option value="h2">h2</option>
                                              <option value="h3">h3</option>
                                              <option value="quote">quote</option>
                                              <option value="code">code</option>
                                              <option value="none">none (do not display)</option>
                                            </select>
                                            <button type="button" onClick={() => {
                                              const next = [...arr];
                                              if (pos <= 0) return;
                                              [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
                                              const nextCfg = { ...(section.typeConfigs || {}) };
                                              const current = (nextCfg[activeVal] as Record<string, unknown> | undefined) || {};
                                              nextCfg[activeVal] = { ...current, fieldOrder: next };
                                              updateSection(index, { typeConfigs: nextCfg });
                                            }} className="px-2 py-1 border rounded">↑</button>
                                            <button type="button" onClick={() => {
                                              const next = [...arr];
                                              if (pos >= next.length - 1) return;
                                              [next[pos + 1], next[pos]] = [next[pos], next[pos + 1]];
                                              const nextCfg = { ...(section.typeConfigs || {}) };
                                              const current = (nextCfg[activeVal] as Record<string, unknown> | undefined) || {};
                                              nextCfg[activeVal] = { ...current, fieldOrder: next };
                                              updateSection(index, { typeConfigs: nextCfg });
                                            }} className="px-2 py-1 border rounded">↓</button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}

                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
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