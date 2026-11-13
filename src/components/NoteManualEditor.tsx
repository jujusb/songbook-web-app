"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { languageLabelFor } from "@/lib/i18n/labels";
import { RecurrentDateSelect } from "@/components/RecurrentDateSelect";
import { useTranslation } from "@/lib/i18n";
import {
  noteManualSectionKey,
  type NoteManualPeriod,
  type NoteManualSectionContent,
  type NoteManualVersionInfo,
  type NoteMetadata,
} from "@/lib/notes";

interface NoteManualEditorProps {
  noteId: string;
  note: NoteMetadata;
  languages: string[];
  initialDate: string;
}

type ManualDrafts = Record<string, NoteManualSectionContent>;

interface ManualSectionRef {
  key: string;
  index: number;
  section: NoteMetadata["sections"][number];
}

function buildDrafts(sections: ManualSectionRef[], content: NoteManualPeriod | null): ManualDrafts {
  const next: ManualDrafts = {};
  for (const { key, section } of sections) {
    const saved = content?.sections?.[key];
    next[key] = saved
      ? {
          md: saved.md ?? "",
          mdByLanguage: saved.mdByLanguage ? { ...saved.mdByLanguage } : undefined,
        }
      : {
          md: section.md ?? "",
          mdByLanguage: section.mdByLanguage ? { ...section.mdByLanguage } : undefined,
        };
  }
  return next;
}

export function NoteManualEditor({
  noteId,
  note,
  languages,
  initialDate,
}: NoteManualEditorProps) {
  const { t } = useTranslation();
  const manualSections = useMemo<ManualSectionRef[]>(
    () =>
      (note.sections || note.content || [])
        .map((section, index) => ({
          key: noteManualSectionKey(section, index),
          index,
          section,
        }))
        .filter(
          ({ section }) =>
            section.type === "manual" &&
            (section.periodic_behavior ?? note.periodic_behavior) === "different_per_period",
        ),
    [note],
  );

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [drafts, setDrafts] = useState<ManualDrafts>(() => buildDrafts(manualSections, null));
  const [versions, setVersions] = useState<NoteManualVersionInfo[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const baseUrl = `/api/notes/${encodeURIComponent(noteId)}/manual`;
  const requestIdRef = useRef(0);

  const loadDate = useCallback(
    async (date: string) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch(`${baseUrl}?date=${encodeURIComponent(date)}`);
        const data = await res.json().catch(() => ({}));
        if (requestId !== requestIdRef.current) return;
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setDrafts(buildDrafts(manualSections, data.content ?? null));
        setVersions(Array.isArray(data.versions) ? data.versions : []);
        setSelectedVersion(null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : t("notes.loadFailed"));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [baseUrl, manualSections, t],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) return loadDate(selectedDate);
    });
    return () => {
      cancelled = true;
    };
  }, [loadDate, selectedDate]);

  const updateDraft = (key: string, patch: NoteManualSectionContent) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, sections: drafts }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setVersions(Array.isArray(data.versions) ? data.versions : []);
      setSelectedVersion(null);
      setMessage("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notes.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleLoadVersion = async (label: string) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `${baseUrl}/${encodeURIComponent(selectedDate)}?label=${encodeURIComponent(label)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setDrafts(buildDrafts(manualSections, data.content ?? null));
      setSelectedVersion(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notes.loadFailed"));
    }
  };

  const handleRestore = async () => {
    if (!selectedVersion) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${baseUrl}/${encodeURIComponent(selectedDate)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: selectedVersion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setVersions(Array.isArray(data.versions) ? data.versions : []);
      setSelectedVersion(null);
      setMessage("Version restored");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notes.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("notes.manualHistoryTitle")}</h1>
          <p className="text-sm text-neutral-500">{note.title}</p>
        </div>
        <Link
          href={`/notes/${noteId}`}
          className="px-3 py-1.5 text-sm border rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          {t("notes.backToNote")}
        </Link>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t("notes.date")}</label>
        <RecurrentDateSelect
          note={note}
          value={selectedDate}
          onChange={(next) => {
            if (!next || next === selectedDate) return;
            setSelectedDate(next);
            const url = new URL(window.location.href);
            url.searchParams.set("date", next);
            window.history.replaceState(null, "", url.toString());
          }}
        />
      </div>

      {manualSections.length === 0 ? (
        <p className="text-sm text-neutral-500">
          This note has no manual parts that change per period. Add one in the{" "}
          <Link href={`/notes/${noteId}/edit`} className="text-blue-600 hover:underline dark:text-blue-400">
            note editor
          </Link>.
        </p>
      ) : loading ? (
        <p className="text-sm text-neutral-500">{t("notes.loading")}</p>
      ) : (
        <div className="space-y-6">
          {manualSections.map(({ key, index, section }, position) => (
            <div key={key} className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">
                  {section.name || `Manual part ${position + 1}`}
                </h2>
                <span className="text-xs text-neutral-500">
                  {(section.periodic_behavior ?? note.periodic_behavior) === "different_per_period"
                    ? "changes per date"
                    : `position ${index + 1}`}
                </span>
              </div>
              {languages.map((lang) => {
                const draft = drafts[key] ?? {};
                const value =
                  draft.mdByLanguage?.[lang] ??
                  (lang === languages[0] ? draft.md ?? "" : "");
                return (
                  <div key={lang} className="space-y-1">
                    <label className="block text-sm font-medium">
                      Text — {languageLabelFor(lang)}
                    </label>
                    <textarea
                      value={value}
                      onChange={(e) => {
                        const mdByLanguage = { ...(draft.mdByLanguage || {}) };
                        mdByLanguage[lang] = e.target.value;
                        const primary = mdByLanguage[languages[0]] || e.target.value;
                        updateDraft(key, { mdByLanguage, md: primary });
                      }}
                      rows={6}
                      placeholder={t("notes.manualPlaceholder")}
                      className="w-full px-3 py-2 border rounded-md text-sm resize-y"
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {selectedVersion && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
              <span>{t("notes.viewingVersion", { version: selectedVersion ?? "" })}</span>
              <button
                type="button"
                onClick={handleRestore}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md disabled:opacity-50"
              >
                Restore this version
              </button>
              <button
                type="button"
                onClick={() => void loadDate(selectedDate)}
                className="px-3 py-1.5 text-sm border rounded-md"
              >
                Cancel
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50"
          >
            {saving ? t("notes.saving") : t("notes.saveForDate")}
          </button>

          <div className="space-y-2">
            <h2 className="font-medium">{t("notes.historyFor", { date: selectedDate })}</h2>
            {versions.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("notes.noEarlierVersions")}</p>
            ) : (
              <ul className="space-y-1">
                {versions.map((version) => (
                  <li key={version.label}>
                    <button
                      type="button"
                      onClick={() => void handleLoadVersion(version.label)}
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {version.label}
                    </button>
                    {version.modified && (
                      <span className="ml-2 text-xs text-neutral-500">
                        {new Date(version.modified).toLocaleString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
