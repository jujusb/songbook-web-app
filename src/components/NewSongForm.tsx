"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { renderVisualChordSheet } from "@/lib/chordpro/visual-render";
import { txtToChordPro } from "@/lib/chordpro/txt-import";
import { useTranslation } from "@/lib/i18n";

function renderPreview(source: string): string {
  return renderVisualChordSheet(source, { repeatChorus: true });
}

const DRAFT_KEY = "songbook-new-song-draft";

export function NewSongForm({
  albums,
  languages,
  defaultLang,
  preselectedAlbum,
}: {
  albums: { id: string; title: string; artist: string }[];
  languages: string[];
  defaultLang: string;
  preselectedAlbum?: string;
}) {
  const router = useRouter();
  const { languageLabel } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wordFileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [lang, setLang] = useState(defaultLang);
  const [key, setKey] = useState("");
  const [albumId, setAlbumId] = useState(preselectedAlbum || "");
  const [chordpro, setChordpro] = useState("");
  const [rawImport, setRawImport] = useState("");
  const [importMode, setImportMode] = useState<"manual" | "file" | "paste" | "chordpro" | "word">("manual");
  const [fileName, setFileName] = useState<string | null>(null);
  const [wordFileName, setWordFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);

  const preview = chordpro ? renderPreview(chordpro) : "";

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ title, lang, key, albumId, chordpro, rawImport, importMode }),
      );
    } catch {
      // localStorage not available
    }
  }, [title, lang, key, albumId, chordpro, rawImport, importMode]);

  // Restore a previously autosaved draft on mount
  /* eslint-disable react-hooks/set-state-in-effect -- legitimately reading external draft data from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (typeof draft.title === "string") setTitle(draft.title);
      if (typeof draft.lang === "string") setLang(draft.lang);
      if (typeof draft.key === "string") setKey(draft.key);
      if (typeof draft.albumId === "string") setAlbumId(draft.albumId);
      if (typeof draft.chordpro === "string") setChordpro(draft.chordpro);
      if (typeof draft.rawImport === "string") setRawImport(draft.rawImport);
      if (typeof draft.importMode === "string") setImportMode(draft.importMode);
      if (draft.title || draft.chordpro || draft.rawImport) setDraftRestored(true);
    } catch {
      // ignore corrupted draft
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Debounced autosave of the form to localStorage
  useEffect(() => {
    if (!autoSave) return;
    const timer = setTimeout(saveDraft, 800);
    return () => clearTimeout(timer);
  }, [autoSave, saveDraft]);

  const handleToggleAutoSave = useCallback(() => {
    if (autoSave) {
      saveDraft();
      setAutoSave(false);
    } else {
      setAutoSave(true);
    }
  }, [autoSave, saveDraft]);

  const processImport = useCallback(
    (text: string) => {
      const result = txtToChordPro(text);

      setChordpro(result.chordpro);

      if (result.title && !title) {
        setTitle(result.title);
      }
      if (result.detectedKey && !key) {
        setKey(result.detectedKey);
      }
    },
    [title, key]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;

        setRawImport(text);
        processImport(text);
      };
      reader.readAsText(file, "utf-8");
    },
    [processImport]
  );

  const handlePasteImport = useCallback(() => {
    if (rawImport.trim()) {
      processImport(rawImport);
    }
  }, [rawImport, processImport]);

  const handleWordImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.name.toLowerCase().endsWith(".docx")) return;

      setImporting(true);
      try {
        const { docxToChordPro } = await import("@/lib/chordpro/docx-import");
        const result = await docxToChordPro(file);
        setChordpro(result.chordpro);
        if (result.title && !title) setTitle(result.title);
        if (result.detectedKey && !key) setKey(result.detectedKey);
        setWordFileName(file.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to import Word document");
      } finally {
        setImporting(false);
      }
    },
    [title, key]
  );

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!chordpro.trim()) {
      setError("Song content is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Prepend key directive if set and not already in the chordpro
      let finalChordpro = chordpro;
      if (key && !chordpro.includes("{key:")) {
        finalChordpro = `{key: ${key}}\n\n${chordpro}`;
      }
      if (!chordpro.includes("{title:")) {
        finalChordpro = `{title: ${title}}\n${finalChordpro}`;
      }

      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title,
          lang,
          albumId,
          chordpro: finalChordpro,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create song");
      }

      router.push(`/songs/${id}?lang=${lang}`);
      router.refresh();
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [title, lang, key, albumId, chordpro, router]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">New Song</h1>
        <div className="flex items-center gap-3">
          {draftRestored && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Draft restored from autosave
            </span>
          )}
          <button
            type="button"
            onClick={handleToggleAutoSave}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              autoSave
                ? "border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50"
                : "border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            {autoSave ? "Autosave: On" : "Autosave: Off"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Metadata fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Amazing Grace"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Album
          </label>
          <select
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No Album</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.artist})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Language
          </label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {languageLabel(l)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Key
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. G, Am, Bb"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Import mode selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Import Source
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setImportMode("manual")}
            className={`px-4 py-2 text-sm rounded-md border transition-colors ${
              importMode === "manual"
                ? "bg-blue-600 text-white border-blue-600"
                : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            Write ChordPro
          </button>
          <button
            type="button"
            onClick={() => setImportMode("file")}
            className={`px-4 py-2 text-sm rounded-md border transition-colors ${
              importMode === "file"
                ? "bg-blue-600 text-white border-blue-600"
                : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            Import TXT File
          </button>
          <button
            type="button"
            onClick={() => setImportMode("word")}
            className={`px-4 py-2 text-sm rounded-md border transition-colors ${
              importMode === "word"
                ? "bg-blue-600 text-white border-blue-600"
                : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            Import from Word
          </button>
          <button
            type="button"
            onClick={() => setImportMode("paste")}
            className={`px-4 py-2 text-sm rounded-md border transition-colors ${
              importMode === "paste"
                ? "bg-blue-600 text-white border-blue-600"
                : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            Paste Text
          </button>
          <button
            type="button"
            onClick={() => setImportMode("chordpro")}
            className={`px-4 py-2 text-sm rounded-md border transition-colors ${
              importMode === "chordpro"
                ? "bg-blue-600 text-white border-blue-600"
                : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            Paste ChordPro
          </button>
        </div>
      </div>

      {/* Import area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left: input */}
        <div>
          {importMode === "file" && (
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Choose File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.cho,.chordpro,.pro,.text"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {fileName && (
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    {fileName}
                  </span>
                )}
                {!fileName && (
                  <span className="text-xs text-neutral-500">
                    or paste / type text below
                  </span>
                )}
              </div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Song text (with chords) &mdash; upload, paste, or type
              </label>
              <textarea
                value={rawImport}
                onChange={(e) => setRawImport(e.target.value)}
                placeholder={`Paste or type your song here, e.g.:\n\nVerse 1:\n   G        G7      C        G\nAmazing grace, how sweet the sound\n     G        Em      D\nThat saved a wretch like me`}
                rows={14}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => { if (rawImport.trim()) processImport(rawImport); }}
                disabled={!rawImport.trim()}
                className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Convert to ChordPro
              </button>
            </div>
          )}

          {importMode === "paste" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Paste your song text (with chords)
              </label>
              <textarea
                value={rawImport}
                onChange={(e) => setRawImport(e.target.value)}
                placeholder={`Verse 1:\n   G        G7      C        G\nAmazing grace, how sweet the sound\n     G        Em      D\nThat saved a wretch like me\n\nChorus:\n  C       G\nAmazing grace\n   Em     D    G\nHow sweet the sound`}
                rows={14}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handlePasteImport}
                className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                Convert to ChordPro
              </button>
            </div>
          )}

          {importMode === "word" && (
            <div className="mb-4">
              <p className="text-sm text-neutral-500 mb-3">
                Choose a .docx Word document; it will be converted to ChordPro.
              </p>
              <div className="flex items-center gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => wordFileInputRef.current?.click()}
                  disabled={importing}
                  className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {importing ? "Converting..." : "Choose File"}
                </button>
                <input
                  ref={wordFileInputRef}
                  type="file"
                  accept=".docx"
                  onChange={handleWordImport}
                  className="hidden"
                />
                {wordFileName && (
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    {wordFileName}
                  </span>
                )}
                {!wordFileName && !importing && (
                  <span className="text-xs text-neutral-500">
                    Only .docx files are supported
                  </span>
                )}
              </div>
              {wordFileName && !importing && (
                <p className="text-xs text-neutral-500">
                  Converted. Review the ChordPro on the right and adjust if needed.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {importMode === "chordpro"
                ? "Paste or type ChordPro"
                : importMode === "manual"
                ? "ChordPro Content"
                : "Converted ChordPro (editable)"}
            </label>
            <textarea
              value={chordpro}
              onChange={(e) => setChordpro(e.target.value)}
              placeholder={importMode === "chordpro"
                ? `Paste your ChordPro content here, e.g.:\n\n{title: Amazing Grace}\n{key: G}\n\n{start_of_verse: Verse 1}\n[G]Amazing [G7]grace, how [C]sweet the [G]sound\nThat [G]saved a [Em]wretch like [D]me\n{end_of_verse}`
                : `{title: My Song}\n{key: G}\n\n{start_of_verse: Verse 1}\n[G]First line of [C]lyrics\n[Am]Second line of [D]lyrics\n{end_of_verse}`}
              rows={importMode === "chordpro" ? 20 : 16}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Right: preview */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Preview
          </label>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-md p-4 min-h-[400px] bg-white dark:bg-neutral-950">
            {preview ? (
              <div
                className="visual-chord-editor visual-chord-sheet"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            ) : (
              <p className="text-neutral-400 text-sm">
                Enter or import song content to see a preview
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim() || !chordpro.trim()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Creating..." : "Create Song"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/songs")}
          className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
