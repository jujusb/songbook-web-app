"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { songIdFromTitle, stripFileExtension } from "@/lib/song-ids";
import {
  acceptAttribute,
  convertFile,
  formatForFileName,
  type ImportFormat,
} from "@/lib/chordpro/document-import";
import { bulkImportSongsAction, type BulkImportOutcome } from "@/app/actions";

type RowStatus = "ready" | "importing" | "done" | "error";

type Row = {
  uid: string;
  fileName: string;
  format: ImportFormat | null;
  title: string;
  /** Song id that will be used on import; kept in sync with the title until edited. */
  id: string;
  idEdited: boolean;
  key: string;
  lang: string;
  /** Overrides the batch album when set. */
  albumId: string;
  chordpro: string;
  status: RowStatus;
  songId?: string;
  error?: string;
  detail?: string;
};

/** Sentinel for the batch album select: create a new album for these songs. */
const NEW_ALBUM = "__new__";

let uidCounter = 0;

function newRow(overrides: Partial<Row>): Row {
  uidCounter += 1;
  return {
    uid: `row-${uidCounter}`,
    fileName: "",
    format: null,
    title: "",
    id: "",
    idEdited: false,
    key: "",
    lang: "",
    albumId: "",
    chordpro: "",
    status: "ready",
    ...overrides,
  };
}

const inputClass =
  "w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const labelClass = "block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1";

export function BulkImport({
  albums,
  artists,
  languages,
  defaultLang,
}: {
  albums: { id: string; title: string; artist: string; year?: number }[];
  artists: { id: string; name: string }[];
  languages: string[];
  defaultLang: string;
}) {
  const { t, languageLabel } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [artistId, setArtistId] = useState("");
  const [albumChoice, setAlbumChoice] = useState("");
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumYear, setNewAlbumYear] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertingName, setConvertingName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [createdAlbum, setCreatedAlbum] = useState<{ id: string; title: string } | null>(
    null
  );

  const busy = converting || importing;

  // A song's artist comes from its album, so only the chosen artist's albums are
  // offered — picking an album from another artist would silently reassign them.
  const artistAlbums = useMemo(
    () => (artistId ? albums.filter((a) => a.artist === artistId) : albums),
    [albums, artistId]
  );

  const pending = useMemo(() => rows.filter((r) => r.status !== "done"), [rows]);
  const importable = pending.filter((r) => r.chordpro.trim());

  const missingAlbumTitle = albumChoice === NEW_ALBUM && !newAlbumTitle.trim();
  const canImport = !busy && importable.length > 0 && !missingAlbumTitle;

  const patchRow = useCallback((uid: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }, []);

  /**
   * Editing a title re-slugifies the id, unless the user typed one themselves —
   * then the manual value wins so it is never silently overwritten.
   */
  const patchTitle = useCallback((uid: string, title: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.uid === uid
          ? {
              ...r,
              title,
              id: r.idEdited ? r.id : songIdFromTitle(title, r.fileName),
            }
          : r
      )
    );
  }, []);

  const patchId = useCallback((uid: string, id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, id, idEdited: true } : r))
    );
  }, []);

  const resetIds = useCallback(() => {
    setRows((prev) =>
      prev.map((r) =>
        r.status === "done" ? r : { ...r, id: songIdFromTitle(r.title, r.fileName), idEdited: false }
      )
    );
  }, []);

  // Documents are converted one at a time: the parsers are CPU-bound, so batching
  // would freeze the tab with no progress feedback.
  const convertFiles = useCallback(
    async (files: File[]) => {
      const convertible = files
        .map((file) => ({ file, format: formatForFileName(file.name) }))
        .filter((f): f is { file: File; format: ImportFormat } => !!f.format);
      const skipped = files.length - convertible.length;
      if (convertible.length === 0) {
        setNotice(null);
        setFatalError(t("bulkImport.unsupported"));
        return;
      }

      setFatalError(null);
      setNotice(skipped > 0 ? t("bulkImport.skipped", { n: skipped }) : null);
      setConverting(true);

      const batchAlbumId = albumChoice === NEW_ALBUM ? "" : albumChoice;

      for (const { file, format } of convertible) {
        setConvertingName(file.name);
        try {
          const result = await convertFile(file, format);
          const title = result.title?.trim() || stripFileExtension(file.name);
          setRows((prev) => [
            ...prev,
            newRow({
              fileName: file.name,
              format,
              title,
              id: songIdFromTitle(title, file.name),
              key: result.detectedKey ?? "",
              chordpro: result.chordpro,
              lang: defaultLang,
              albumId: batchAlbumId,
            }),
          ]);
        } catch (err) {
          const title = stripFileExtension(file.name);
          setRows((prev) => [
            ...prev,
            newRow({
              fileName: file.name,
              format,
              title,
              id: songIdFromTitle(title, file.name),
              lang: defaultLang,
              albumId: batchAlbumId,
              status: "error",
              error: "CONVERT_FAILED",
              detail: err instanceof Error ? err.message : undefined,
            }),
          ]);
        }
      }

      setConvertingName(null);
      setConverting(false);
    },
    [albumChoice, defaultLang, t]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length > 0) void convertFiles(files);
    },
    [convertFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length > 0) void convertFiles(files);
    },
    [convertFiles]
  );

  /** Change the target for every row that has not been imported yet. */
  const applyBatchTarget = useCallback((albumId: string) => {
    setRows((prev) => prev.map((r) => (r.status === "done" ? r : { ...r, albumId })));
  }, []);

  const handleArtistChange = useCallback(
    (nextArtistId: string) => {
      setArtistId(nextArtistId);
      // Keep the album consistent with the new artist: reset unless the current
      // pick still belongs to them.
      const stillValid = albums.some(
        (a) => a.id === albumChoice && a.artist === nextArtistId
      );
      const nextAlbum = stillValid ? albumChoice : "";
      setAlbumChoice(nextAlbum);
      applyBatchTarget(nextAlbum);
    },
    [albumChoice, albums, applyBatchTarget]
  );

  const handleAlbumChange = useCallback(
    (nextAlbumId: string) => {
      setAlbumChoice(nextAlbumId);
      applyBatchTarget(nextAlbumId === NEW_ALBUM ? "" : nextAlbumId);
    },
    [applyBatchTarget]
  );

  const handleLanguageChange = useCallback((lang: string) => {
    setRows((prev) => prev.map((r) => (r.status === "done" ? r : { ...r, lang })));
  }, []);

  const handleImport = useCallback(async () => {
    if (importable.length === 0) return;

    setImporting(true);
    setFatalError(null);
    setNotice(null);
    setRows((prev) =>
      prev.map((r) =>
        r.status === "done" || !r.chordpro.trim()
          ? r
          : { ...r, status: "importing", error: undefined, detail: undefined }
      )
    );

    try {
      const result = await bulkImportSongsAction(
        importable.map((r) => ({
          fileName: r.fileName,
          format: r.format ?? "txt",
          title: r.title,
          id: r.id,
          lang: r.lang,
          albumId: r.albumId,
          chordpro: r.chordpro,
          key: r.key,
        })),
        {
          artistId,
          albumId: albumChoice === NEW_ALBUM ? "" : albumChoice,
          newAlbumTitle,
          newAlbumYear: newAlbumYear ? Number(newAlbumYear) : undefined,
        }
      );

      setRows((prev) =>
        prev.map((row) => {
          const index = importable.findIndex((r) => r.uid === row.uid);
          if (index === -1) return row;
          const outcome: BulkImportOutcome | undefined = result.outcomes[index];
          if (!outcome) return { ...row, status: "ready" as const };
          return outcome.ok
            ? { ...row, status: "done" as const, songId: outcome.songId }
            : {
                ...row,
                status: "error" as const,
                error: outcome.error ?? "FAILED",
                detail: outcome.detail,
              };
        })
      );

      if (result.createdAlbum) setCreatedAlbum(result.createdAlbum);
    } catch (err) {
      setFatalError(
        err instanceof Error ? err.message : t("bulkImport.error.FAILED")
      );
      setRows((prev) =>
        prev.map((r) => (r.status === "importing" ? { ...r, status: "ready" } : r))
      );
    } finally {
      setImporting(false);
    }
  }, [albumChoice, artistId, importable, newAlbumTitle, newAlbumYear, t]);

  const removeRow = useCallback((uid: string) => {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
  }, []);

  const clearDone = useCallback(() => {
    setRows((prev) => prev.filter((r) => r.status !== "done"));
  }, []);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptAttribute()}
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t("bulkImport.chooseFiles")}
        </button>
        <p className="text-sm text-neutral-500 mt-3">{t("bulkImport.dropHint")}</p>
        {converting && (
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
            {t("bulkImport.converting", { name: convertingName ?? "" })}
          </p>
        )}
      </div>

      {fatalError && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{fatalError}</p>
      )}
      {notice && (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">{notice}</p>
      )}
      {createdAlbum && (
        <p className="mt-4 text-sm text-green-700 dark:text-green-400">
          {t("bulkImport.albumCreated", { title: createdAlbum.title })}{" "}
          <Link
            href={`/albums/${createdAlbum.id}`}
            className="underline hover:no-underline"
          >
            {t("bulkImport.openAlbum")}
          </Link>
        </p>
      )}

      {/* Batch destination: artist + album, plus the language applied to all rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-4">
        <div>
          <label className={labelClass}>{t("bulkImport.artist")}</label>
          <select
            value={artistId}
            onChange={(e) => handleArtistChange(e.target.value)}
            disabled={busy}
            className={inputClass}
          >
            <option value="">{t("bulkImport.noArtist")}</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("bulkImport.album")}</label>
          <select
            value={albumChoice}
            onChange={(e) => handleAlbumChange(e.target.value)}
            disabled={busy}
            className={inputClass}
          >
            <option value="">{t("bulkImport.noAlbum")}</option>
            {artistAlbums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
                {a.year ? ` (${a.year})` : ""}
              </option>
            ))}
            <option value={NEW_ALBUM}>{t("bulkImport.newAlbum")}</option>
          </select>
        </div>
        {albumChoice === NEW_ALBUM && (
          <>
            <div>
              <label className={labelClass}>{t("bulkImport.newAlbumTitle")}</label>
              <input
                type="text"
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
                disabled={busy}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("bulkImport.newAlbumYear")}</label>
              <input
                type="number"
                value={newAlbumYear}
                onChange={(e) => setNewAlbumYear(e.target.value)}
                disabled={busy}
                placeholder="2024"
                className={inputClass}
              />
            </div>
          </>
        )}
        <div>
          <label className={labelClass}>{t("bulkImport.language")}</label>
          <select
            value={defaultLang}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={busy}
            className={inputClass}
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {languageLabel(l)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {missingAlbumTitle && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
          {t("bulkImport.newAlbumTitleRequired")}
        </p>
      )}

      {rows.length === 0 ? null : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing
                ? t("bulkImport.importing")
                : t("bulkImport.importCount", { n: importable.length })}
            </button>
            {rows.some((r) => r.idEdited) && (
              <button
                type="button"
                onClick={resetIds}
                disabled={busy}
                className="px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {t("bulkImport.resetIds")}
              </button>
            )}
            {rows.some((r) => r.status === "done") && (
              <button
                type="button"
                onClick={clearDone}
                className="px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {t("bulkImport.clearDone")}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <RowCard
                key={row.uid}
                row={row}
                albums={albums}
                languages={languages}
                busy={busy}
                onPatch={patchRow}
                onPatchTitle={patchTitle}
                onPatchId={patchId}
                onRemove={removeRow}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RowCard({
  row,
  albums,
  languages,
  busy,
  onPatch,
  onPatchTitle,
  onPatchId,
  onRemove,
}: {
  row: Row;
  albums: { id: string; title: string; artist: string }[];
  languages: string[];
  busy: boolean;
  onPatch: (uid: string, patch: Partial<Row>) => void;
  onPatchTitle: (uid: string, title: string) => void;
  onPatchId: (uid: string, id: string) => void;
  onRemove: (uid: string) => void;
}) {
  const { t, languageLabel } = useTranslation();

  const status = (() => {
    switch (row.status) {
      case "importing":
        return t("bulkImport.importing");
      case "done":
        return t("bulkImport.imported");
      case "error":
        return t(`bulkImport.error.${row.error ?? "FAILED"}`);
      default:
        return null;
    }
  })();

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{row.title || row.fileName}</div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 min-w-0">
            <span className="truncate">{row.fileName}</span>
            {row.format && <span className="shrink-0">· {t(`bulkImport.format.${row.format}`)}</span>}
            <code className="shrink-0 px-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {row.songId ?? row.id}
            </code>
          </div>
        </div>
        {status && (
          <span
            className={`text-xs px-2 py-1 rounded shrink-0 ${
              row.status === "done"
                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                : row.status === "error"
                  ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            }`}
          >
            {status}
          </span>
        )}
        {row.status === "done" ? (
          row.songId && (
            <Link
              href={`/songs/${row.songId}?lang=${row.lang}`}
              className="text-xs px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
            >
              {t("bulkImport.open")}
            </Link>
          )
        ) : (
          <button
            type="button"
            onClick={() => onRemove(row.uid)}
            disabled={busy}
            className="text-xs px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors shrink-0"
          >
            {t("bulkImport.remove")}
          </button>
        )}
      </div>

      {row.status === "done" ? null : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
            <div>
              <label className={labelClass}>{t("bulkImport.title")}</label>
              <input
                type="text"
                value={row.title}
                onChange={(e) => onPatchTitle(row.uid, e.target.value)}
                disabled={busy}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("bulkImport.id")}</label>
              <input
                type="text"
                value={row.id}
                onChange={(e) => onPatchId(row.uid, e.target.value)}
                disabled={busy}
                spellCheck={false}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className={labelClass}>{t("bulkImport.key")}</label>
              <input
                type="text"
                value={row.key}
                onChange={(e) => onPatch(row.uid, { key: e.target.value })}
                placeholder="G, Am, Bb"
                disabled={busy}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("bulkImport.album")}</label>
              <select
                value={row.albumId}
                onChange={(e) => onPatch(row.uid, { albumId: e.target.value })}
                disabled={busy}
                className={inputClass}
              >
                <option value="">{t("bulkImport.batchAlbum")}</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("bulkImport.language")}</label>
              <select
                value={row.lang}
                onChange={(e) => onPatch(row.uid, { lang: e.target.value })}
                disabled={busy}
                className={inputClass}
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {languageLabel(l)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {row.status === "error" && row.error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {t(`bulkImport.error.${row.error}`)}
              {row.detail ? `: ${row.detail}` : ""}
            </p>
          )}

          {row.chordpro.trim() && (
            <details className="mt-3">
              <summary className="text-xs text-neutral-500 cursor-pointer select-none">
                {t("bulkImport.preview")}
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto text-xs font-mono whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md p-3">
                {row.chordpro}
              </pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}
