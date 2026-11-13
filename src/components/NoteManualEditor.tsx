"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { languageLabelFor } from "@/lib/i18n/labels";
import { RecurrentDateSelect } from "@/components/RecurrentDateSelect";
import { MarkdownView } from "@/components/MarkdownView";
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
  // One language is shown at a time; drafts for all languages stay in state.
  const defaultLang = languages.includes(note.language) ? note.language : languages[0] ?? note.language;
  const [activeLang, setActiveLang] = useState(defaultLang);
  const currentLang = languages.includes(activeLang) ? activeLang : defaultLang;
  const [drafts, setDrafts] = useState<ManualDrafts>(() => buildDrafts(manualSections, null));
  // Every section in saved order (editable, static and API), for the layout.
  const allSections = useMemo<ManualSectionRef[]>(
    () =>
      (note.sections || note.content || []).map((section, index) => ({
        key: noteManualSectionKey(section, index),
        index,
        section,
      })),
    [note],
  );
  const isEditablePart = (section: ManualSectionRef["section"]) =>
    section.type === "manual" && (section.periodic_behavior ?? note.periodic_behavior) === "different_per_period";
  // API results for the selected date, keyed by section index (read-only).
  const [apiTexts, setApiTexts] = useState<Record<number, { text: string; tabs?: Array<{ title: string; text: string }> }>>({});
  // Active result tab per API section (only used when the API returns several results).
  const [apiTab, setApiTab] = useState<Record<number, number>>({});
  useEffect(() => {
    let cancelled = false;
    const apiParts = allSections.filter(({ section }) => section.type === "api" && section.api_url);
    if (apiParts.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        apiParts.map(async ({ index, section }) => {
          try {
            const res = await fetch(`/api/notes/${noteId}/preview/${index}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lang: currentLang, date: selectedDate }),
            });
            const payload = (await res.json()) as { text?: string; tabs?: Array<{ text: string }>; error?: string };
            if (!res.ok) return [index, { text: `[${section.name || "api"}] ${payload?.error || `HTTP ${res.status}`}` }] as const;
            const tabs = payload.tabs && payload.tabs.length > 0 ? payload.tabs : undefined;
            const text = payload.text ?? "";
            return [index, { text, tabs }] as const;
          } catch (err) {
            return [index, { text: `[${section.name || "api"}] ${err instanceof Error ? err.message : ""}` }] as const;
          }
        }),
      );
      if (!cancelled) setApiTexts(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [allSections, noteId, currentLang, selectedDate]);
  const staticText = (section: ManualSectionRef["section"], lang: string) =>
    section.mdByLanguage?.[lang] ?? section.md ?? "";
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
      setMessage(t("common.saved"));
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
      setMessage(t("noteManual.versionRestored"));
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

      {allSections.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {t("noteManual.noManualParts")}
          <Link href={`/notes/${noteId}/edit`} className="text-blue-600 hover:underline dark:text-blue-400">
            {t("noteManual.noteEditor")}
          </Link>.
        </p>
      ) : loading ? (
        <p className="text-sm text-neutral-500">{t("notes.loading")}</p>
      ) : (
        <div className="space-y-6">
          {languages.length > 1 && (
            <div role="tablist" aria-label={t("noteManual.languageTabs")} className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-700">
              {languages.map((lang) => {
                const active = lang === currentLang;
                return (
                  <button
                    key={lang}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveLang(lang)}
                    className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
                      active
                        ? "border-blue-600 font-medium text-blue-600 dark:text-blue-400"
                        : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    {languageLabelFor(lang)}
                  </button>
                );
              })}
            </div>
          )}
          {allSections.map(({ key, index, section }, position) => {
            if (!isEditablePart(section)) {
              const lang = currentLang;
              const isApi = section.type === "api";
              const api = apiTexts[index];
              const text = isApi ? api?.text ?? t("noteManual.apiLoading") : staticText(section, lang);
              const tabs = isApi ? api?.tabs : undefined;
              const activeTab = Math.min(apiTab[index] ?? 0, (tabs?.length ?? 1) - 1);
              return (
                <div key={key} className="border rounded-md p-4 space-y-2 bg-neutral-50 dark:bg-neutral-900" data-testid="manual-readonly-part">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-medium">{section.name || t("noteManual.manualPart", { number: position + 1 })}</h2>
                    <span className="text-xs text-neutral-500">{isApi ? t("noteManual.readOnlyApi") : t("noteManual.readOnlyStatic")}</span>
                  </div>
                  {tabs ? (
                    <>
                      {text && <MarkdownView text={text} />}
                      <div role="tablist" className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-700">
                        {tabs.map((tab, i) => (
                          <button
                            key={`${tab.title}-${i}`}
                            type="button"
                            role="tab"
                            aria-selected={i === activeTab}
                            onClick={() => setApiTab((prev) => ({ ...prev, [index]: i }))}
                            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
                              i === activeTab
                                ? "border-blue-600 font-medium text-blue-600 dark:text-blue-400"
                                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                            }`}
                          >
                            {tab.title}
                          </button>
                        ))}
                      </div>
                      <MarkdownView text={tabs[activeTab]?.text || ""} />
                    </>
                  ) : (
                    <MarkdownView text={text} />
                  )}
                </div>
              );
            }
            return (

              <div key={key} className="border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium">
                    {section.name || t("noteManual.manualPart", { number: position + 1 })}
                  </h2>
                  <span className="text-xs text-neutral-500">
                    {(section.periodic_behavior ?? note.periodic_behavior) === "different_per_period"
                      ? t("noteManual.changesPerDate")
                      : t("noteManual.position", { number: index + 1 })}
                  </span>
                </div>
                {(() => {
                  const lang = currentLang;
                  const draft = drafts[key] ?? {};
                  const value =
                    draft.mdByLanguage?.[lang] ??
                    (lang === languages[0] ? draft.md ?? "" : "");
                  return (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium">
                        {t("noteForm.textFor", { language: languageLabelFor(lang) })}
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
                })()}
              </div>
            
            );
          })}

          {manualSections.length === 0 && (
            <p className="text-sm text-neutral-500">
              {t("noteManual.noManualParts")}
              <Link href={`/notes/${noteId}/edit`} className="text-blue-600 hover:underline dark:text-blue-400">
                {t("noteManual.noteEditor")}
              </Link>.
            </p>
          )}
          {selectedVersion && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
              <span>{t("notes.viewingVersion", { version: selectedVersion ?? "" })}</span>
              <button
                type="button"
                onClick={handleRestore}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md disabled:opacity-50"
              >
                {t("noteManual.restoreVersion")}
              </button>
              <button
                type="button"
                onClick={() => void loadDate(selectedDate)}
                className="px-3 py-1.5 text-sm border rounded-md"
              >
                {t("common.cancel")}
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
