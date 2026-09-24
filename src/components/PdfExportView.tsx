"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

export interface ScopeOption {
  id: string;
  title: string;
  meta?: string;
}

export interface InstrumentGroup {
  slug: string;
  label: string;
}

export interface InstrumentalFile {
  file: string;
  title: string;
  songTitle: string;
}

export interface ViewerSong {
  songId: string;
  title: string;
  lang: string;
}

type PdfType = "chords" | "instrumental";

export function PdfExportView({
  type,
  scope,
  id,
  share,
  scopeLocked,
  instruments,
  selectedInstrument,
  instrumentalFiles,
  viewerSongs,
  albums,
  artists,
  songs,
  setlists,
  languages,
  selectedLangs,
  includeRefs,
  canExport,
}: {
  type: PdfType;
  scope: string;
  id: string;
  share?: string;
  scopeLocked?: boolean;
  instruments: InstrumentGroup[];
  selectedInstrument?: string;
  instrumentalFiles: InstrumentalFile[];
  viewerSongs: ViewerSong[];
  albums: ScopeOption[];
  artists: ScopeOption[];
  songs: ScopeOption[];
  setlists: ScopeOption[];
  languages: string[];
  selectedLangs: string[];
  includeRefs: boolean;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, languageLabel } = useTranslation();

  const [checkedFiles, setCheckedFiles] = useState<string[]>(
    instrumentalFiles.map((f) => f.file)
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Build the request body for the current selection — shared by the preview
  // and the download so both produce the exact same PDF.
  const buildRequest = useCallback(() => {
    return type === "instrumental"
      ? {
          type: "instrumental" as const,
          scope,
          id: id || null,
          share: share || null,
          instrument: selectedInstrument || null,
          files: checkedFiles.length > 0 ? checkedFiles : null,
        }
      : {
          type: "chords" as const,
          scope,
          id: id || null,
          share: share || null,
          lang: selectedLangs[0],
          langs: selectedLangs.slice(1),
          refs: includeRefs,
        };
  }, [
    type,
    scope,
    id,
    share,
    selectedInstrument,
    checkedFiles,
    selectedLangs,
    includeRefs,
  ]);

  const generatePdf = useCallback(async (): Promise<Blob> => {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequest()),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? t("pdf.downloadFailed"));
    }
    return res.blob();
  }, [buildRequest, t]);

  const showPreview = useCallback((blob: Blob) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setPreviewError(null);
    setPreviewLoading(false);
  }, []);

  // Debounced auto-preview: regenerate whenever the selection changes.
  useEffect(() => {
    if (!canExport) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const blob = await generatePdf();
        if (!cancelled) showPreview(blob);
      } catch (err) {
        if (cancelled) return;
        setPreviewError(err instanceof Error ? err.message : t("pdf.downloadFailed"));
        setPreviewLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [generatePdf, canExport, t, showPreview]);

  // Revoke the last preview object URL on unmount.
  useEffect(() => {
    return () => {
      const url = previewUrlRef.current;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const buildQuery = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      return params;
    },
    [searchParams]
  );

  const toggleFile = useCallback((file: string) => {
    setCheckedFiles((prev) =>
      prev.includes(file)
        ? prev.filter((f) => f !== file)
        : [...prev, file]
    );
  }, []);

  const toggleAllFiles = useCallback(
    (checked: boolean) => {
      setCheckedFiles(checked ? instrumentalFiles.map((f) => f.file) : []);
    },
    [instrumentalFiles]
  );

  const toggleLang = useCallback(
    (lang: string) => {
      const next = selectedLangs.includes(lang)
        ? selectedLangs.filter((l) => l !== lang)
        : [...selectedLangs, lang];
      if (next.length === 0) return;
      router.push(
        `/pdf?${buildQuery({ lang: next[0], langs: next.slice(1).join(",") }).toString()}`
      );
    },
    [selectedLangs, router, buildQuery]
  );

  const selectAllLangs = useCallback(() => {
    router.push(
      `/pdf?${buildQuery({ lang: languages[0], langs: languages.slice(1).join(",") }).toString()}`
    );
  }, [languages, router, buildQuery]);

  const handleDownload = useCallback(async () => {
    if (!canExport) return;
    setBusy(true);
    setFailed(null);
    try {
      const blob = await generatePdf();
      const filename =
        type === "instrumental"
          ? `songbook-instrumental-${scope}${id ? `-${id}` : ""}.pdf`
          : "songbook.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : t("pdf.downloadFailed"));
    } finally {
      setBusy(false);
    }
  }, [type, scope, id, generatePdf, canExport, t]);

  const scopeSelector = (currentScope: string, currentId: string) => {
    const options: { value: string; label: string; list: ScopeOption[] }[] = [
      { value: "all", label: t("pdf.scopeAll"), list: [] },
      { value: "album", label: t("pdf.scopeAlbum"), list: albums },
      { value: "artist", label: t("pdf.scopeArtist"), list: artists },
      { value: "song", label: t("pdf.scopeSong"), list: songs },
      { value: "setlist", label: t("pdf.scopeSetlist"), list: setlists },
    ];
    const active = options.find((o) => o.value === currentScope) ?? options[0];
    const activeItem = active.list.find((o) => o.id === currentId);

    if (scopeLocked) {
      return (
        <div>
          <label className="block text-sm font-medium mb-2">
            {t("pdf.scope")}
          </label>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 rounded-md px-3 py-2">
            {active.label}
            {activeItem ? ` — ${activeItem.title}` : ""}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-2">
            {t("pdf.scope")}
          </label>
          <div className="space-y-2">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  checked={currentScope === option.value}
                  onChange={() => {
                    const query = buildQuery({
                      scope: option.value,
                      id: option.value === "all" ? "" : option.value === "setlist" && setlists[0]?.id ? setlists[0].id : option.list[0]?.id ?? "",
                    });
                    router.push(`/pdf?${query.toString()}`);
                  }}
                  className="accent-blue-600"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
          {active.value !== "all" && active.list.length > 0 && (
            <select
              value={currentId}
              onChange={(e) => {
                const query = buildQuery({ id: e.target.value });
                router.push(`/pdf?${query.toString()}`);
              }}
              className="mt-2 w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {active.list.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                  {option.meta ? ` — ${option.meta}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Type toggle */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t("pdf.type")}
        </label>
        <div className="flex gap-2">
          {(["chords", "instrumental"] as PdfType[]).map((tpe) => (
            <button
              key={tpe}
              type="button"
              onClick={() => {
                const query = buildQuery({ type: tpe });
                router.push(`/pdf?${query.toString()}`);
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                type === tpe
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              {tpe === "chords" ? t("pdf.chords") : t("pdf.instrumental")}
            </button>
          ))}
        </div>
      </div>

      {scopeSelector(scope, id)}

      {type === "chords" &&
        scope !== "setlist" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">{t("pdf.languages")}</label>
              <button
                type="button"
                onClick={selectAllLangs}
                className="text-xs text-blue-600 hover:text-blue-500"
              >
                {t("pdf.selectAll")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {languages.map((lang) => (
                <label
                  key={lang}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ${
                    selectedLangs.includes(lang)
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                      : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLangs.includes(lang)}
                    onChange={() => toggleLang(lang)}
                    className="sr-only"
                  />
                  {languageLabel(lang)}
                </label>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer mt-3">
          <input
            type="checkbox"
            checked={includeRefs}
            onChange={(e) => {
              const query = buildQuery({ refs: e.target.checked ? "1" : "" });
              router.push(`/pdf?${query.toString()}`);
            }}
            className="accent-blue-600"
          />
          <span className="text-sm">{t("pdf.includeReferences")}</span>
        </label>

      {type === "instrumental" && (
        <div>
          <label className="block text-sm font-medium mb-2">
            {t("pdf.instrument")}
          </label>
          {instruments.length === 0 ? (
            <p className="text-xs text-neutral-400">{t("pdf.noInstruments")}</p>
          ) : (
            <div>
              <div className="flex flex-wrap gap-1">
                {instruments.map((inst) => (
                  <button
                    key={inst.slug}
                    type="button"
                    onClick={() => {
                      const query = buildQuery({ instrument: inst.slug });
                      router.push(`/pdf?${query.toString()}`);
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
                      selectedInstrument === inst.slug
                        ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black"
                        : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {inst.label}
                  </button>
                ))}
              </div>
              {instrumentalFiles.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">
                      {t("pdf.files")}
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          checkedFiles.length === instrumentalFiles.length &&
                          instrumentalFiles.length > 0
                        }
                        onChange={(e) => toggleAllFiles(e.target.checked)}
                        className="accent-blue-600"
                      />
                      {t("pdf.selectAll")}
                    </label>
                  </div>
                  <ul className="border border-neutral-200 dark:border-neutral-800 rounded-md divide-y divide-neutral-200 dark:divide-neutral-800">
                    {instrumentalFiles.map((file) => (
                      <li
                        key={file.file}
                        className="flex items-start gap-2 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checkedFiles.includes(file.file)}
                          onChange={() => toggleFile(file.file)}
                          className="accent-blue-600 mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="text-neutral-500 text-xs block">
                            {file.songTitle}
                          </span>
                          <span className="font-medium">{file.title}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Viewer: the data that will be included */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t("pdf.viewTitle")}
        </label>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-md p-4">
          {type === "chords" ? (
            viewerSongs.length === 0 ? (
              <p className="text-sm text-neutral-400">{t("pdf.noSongs")}</p>
            ) : (
              <>
                <p className="text-xs text-neutral-500 mb-2">
                  {t("pdf.songCount", { n: viewerSongs.length })}
                </p>
                <ol className="list-decimal pl-5 space-y-1">
                  {viewerSongs.map((song) => (
                    <li key={`${song.songId}-${song.lang}`} className="text-sm">
                      <span className="font-medium">{song.title}</span>
                      <span className="text-xs text-neutral-400 ml-1">
                        ({languageLabel(song.lang)})
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )
          ) : instrumentalFiles.length === 0 ? (
            <p className="text-sm text-neutral-400">{t("pdf.noFiles")}</p>
          ) : (
            <>
              <p className="text-xs text-neutral-500 mb-2">
                {t("pdf.fileCount", { n: checkedFiles.length })}
              </p>
              <ul className="space-y-1">
                {instrumentalFiles.filter((f) => checkedFiles.includes(f.file)).map((file) => (
                  <li key={file.file} className="text-sm">
                    <span className="font-medium">{file.songTitle}</span>
                    <span className="text-neutral-400"> &middot; </span>
                    <span>{file.title}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* PDF preview */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t("pdf.previewTitle")}
        </label>
        <div className={`relative ${previewUrl ? "" : "min-h-[40vh]"}`}>
          {previewUrl && (
            <iframe
              key={previewUrl}
              src={previewUrl}
              title={t("pdf.previewTitle")}
              className="h-[75vh] w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white"
            />
          )}
          {previewLoading ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/90 dark:bg-neutral-900/90 text-sm text-neutral-400">
              {t("pdf.preparing")}
            </div>
          ) : !previewUrl && previewError ? (
            <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 text-sm text-red-600 dark:text-red-400">
              {previewError}
            </div>
          ) : !previewUrl ? (
            <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 h-[40vh] flex items-center justify-center text-sm text-neutral-400">
              {t("pdf.noPreviewYet")}
            </div>
          ) : null}
        </div>
      </div>

      {/* Download */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy || !canExport}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {busy
            ? t("pdf.preparing")
            : type === "instrumental"
              ? t("pdf.downloadInstrumental")
              : t("pdf.downloadChords")}
        </button>
        {failed && (
          <span className="text-sm text-red-600 dark:text-red-400">{failed}</span>
        )}
      </div>
    </div>
  );
}