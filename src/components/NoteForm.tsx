"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { notesApi, NoteMetadata } from "@/lib/notes";

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

const API_SOURCES = [
  { value: "manual", label: "Manual entry" },
  { value: "api", label: "External API" },
  { value: "custom", label: "Custom" },
];

interface NoteFormProps {
  initialNote?: NoteMetadata;
  isNew?: boolean;
  noteId?: string;
}

export function NoteForm({
  initialNote,
  isNew = true,
  noteId,
}: NoteFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(
    !isNew && !!noteId && !initialNote
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  const [title, setTitle] = useState(initialNote?.title ?? "");
  const [language, setLanguage] = useState(initialNote?.language ?? "en");
  const [recurrentType, setRecurrentType] = useState(
    initialNote?.recurrent_type ?? "weekly"
  );
  const [recurrentSchedule, setRecurrentSchedule] = useState(
    initialNote?.recurrent_schedule ?? "sunday"
  );
  const [periodicBehavior, setPeriodicBehavior] = useState(
    initialNote?.periodic_behavior ?? "same"
  );
  const [apiSource, setApiSource] = useState(
    initialNote?.api_source ?? "manual"
  );
  const [apiUrl, setApiUrl] = useState(
    initialNote?.api_sources?.[0]?.api_url ?? ""
  );
  const [resultSection, setResultSection] = useState(
    initialNote?.api_sources?.[0]?.resultSection ?? ""
  );
  const [tags, setTags] = useState(
    initialNote?.tags ? initialNote.tags.join(", ") : ""
  );
  const [contentMd, setContentMd] = useState(
    initialNote?.content?.[0]?.md ?? ""
  );

  useEffect(() => {
    if (!isNew && noteId && !initialNote) {
      notesApi.fetchNote(noteId).then((n) => {
        if (!n) {
          setNotFoundFlag(true);
          setIsLoading(false);
          return;
        }
        setTitle(n.title);
        setLanguage(n.language);
        setRecurrentType(n.recurrent_type);
        setRecurrentSchedule(n.recurrent_schedule);
        setPeriodicBehavior(n.periodic_behavior);
        setApiSource(n.api_source);
        setApiUrl(n.api_sources?.[0]?.api_url ?? "");
        setResultSection(n.api_sources?.[0]?.resultSection ?? "");
        setTags(n.tags ? n.tags.join(", ") : "");
        setContentMd(n.content?.[0]?.md ?? "");
        setIsLoading(false);
      });
    }
  }, [isNew, noteId, initialNote]);

  const isEdit = !isNew;

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const note: NoteMetadata = {
        id: isEdit ? (noteId ?? `note-${Date.now()}`) : `note-${Date.now()}`,
        title: title.trim(),
        language,
        recurrent_type: recurrentType,
        recurrent_schedule: recurrentSchedule,
        periodic_behavior: periodicBehavior,
        api_source: apiSource,
        api_sources:
          apiSource === "manual"
            ? []
            : [
                {
                  name: "custom-api",
                  api_url: apiUrl.trim(),
                  resultSection: resultSection.trim(),
                },
              ],
        last_fetched: isEdit ? "" : new Date().toISOString(),
        last_edited: new Date().toISOString(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        content: [
          {
            type: "manual",
            md: contentMd,
          },
        ],
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }, [
    title,
    language,
    recurrentType,
    recurrentSchedule,
    periodicBehavior,
    apiSource,
    apiUrl,
    resultSection,
    tags,
    contentMd,
    isEdit,
    noteId,
    router,
  ]);

  if (notFoundFlag) notFound();
  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl">
        <p className="text-sm text-neutral-500">Loading note…</p>
      </div>
    );
  }

  const showApiFields = apiSource === "api" || apiSource === "custom";

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {isEdit ? "Edit Note" : "New Recurrent Note"}
      </h1>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Recurrent type
            </label>
            <select
              value={recurrentType}
              onChange={(e) =>
                setRecurrentType(
                  e.target.value as "weekly" | "monthly" | "specific-dates" | "daily"
                )
              }
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RECURRENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Recurrent schedule
            </label>
            <select
              value={recurrentSchedule}
              onChange={(e) => setRecurrentSchedule(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SCHEDULES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Periodic behavior
            </label>
            <select
              value={periodicBehavior}
              onChange={(e) =>
                setPeriodicBehavior(
                  e.target.value as "same" | "different_per_period"
                )
              }
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PERIODIC_BEHAVIORS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            API source
          </label>
          <select
            value={apiSource}
            onChange={(e) =>
              setApiSource(e.target.value as "manual" | "api" | "custom")
            }
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {API_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {showApiFields && (
          <div className="space-y-2 mt-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                API endpoint
              </label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.example.com/endpoint?lang=${LANG}"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Result section
              </label>
              <input
                type="text"
                value={resultSection}
                onChange={(e) => setResultSection(e.target.value)}
                placeholder="e.g. text / daily-text"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="gospel, lectionary, weekly"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Content (Markdown)
          </label>
          <textarea
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            placeholder="Note content in Markdown..."
            rows={10}
            disabled={apiSource === "api"}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-h"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving
            ? "Saving…"
            : isEdit
            ? "Save Note"
            : "Create Note"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/notes")}
          className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
