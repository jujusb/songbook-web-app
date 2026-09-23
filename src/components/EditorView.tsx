"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView as CMEditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { saveSongAction, saveSongReferencesAction } from "@/app/actions";
import { VisualChordEditor } from "@/components/VisualChordEditor";
import { ReadOnlyChordSource } from "@/components/ReadOnlyChordSource";
import { renderVisualChordSheet } from "@/lib/chordpro/visual-render";
import { useTranslation } from "@/lib/i18n";
import { txtToChordPro } from "@/lib/chordpro/txt-import";
import { parseReferences, type ParsedReference } from "@/lib/chordpro/reference-import";
import type { Reference } from "@/lib/content/schemas";

type ImportTab = "text" | "pdf" | "word";

type EditorViewMode = "code" | "visual";

export function EditorView({
  songId,
  lang,
  initialContent,
  translations,
  translationsContent,
}: {
  songId: string;
  lang: string;
  initialContent: string;
  translations: string[];
  translationsContent: Record<string, string>;
}) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const cmViewRef = useRef<CMEditorView | null>(null);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const contentRef = useRef(content);
  const savingRef = useRef(false);
  const lastSavedRef = useRef(content);
  const [leftView, setLeftView] = useState<EditorViewMode>("visual");
  const [compareOn, setCompareOn] = useState(false);
  const [compareLang, setCompareLang] = useState<string | null>(null);
  const [compareView, setCompareView] = useState<EditorViewMode>("visual");
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>("text");
  const [importText, setImportText] = useState("");
  const [importRefText, setImportRefText] = useState("");
  const [importRefs, setImportRefs] = useState<ParsedReference[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const preview = renderVisualChordSheet(content, { repeatChorus: true });

  const otherLangs = translations.filter((l) => l !== lang);
  const validCompareLang =
    compareLang && otherLangs.includes(compareLang) ? compareLang : (otherLangs[0] ?? null);
  const compareSource = (validCompareLang ? translationsContent[validCompareLang] : undefined) ?? "";
  const comparePreview = renderVisualChordSheet(compareSource, { repeatChorus: false });
  const showCompare = compareOn && otherLangs.length > 0;

  // Keep refs in sync with the latest content
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Initialize CodeMirror when switching to code mode
  useEffect(() => {
    if (leftView !== "code") return;
    if (!editorRef.current) return;

    // Destroy previous instance if any
    if (cmViewRef.current) {
      cmViewRef.current.destroy();
      cmViewRef.current = null;
    }

    const updateListener = CMEditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setContent(update.state.doc.toString());
        setSaved(false);
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        history(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        updateListener,
        CMEditorView.lineWrapping,
        CMEditorView.theme({
          "&": { height: "100%", fontSize: "14px" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { fontFamily: "var(--font-geist-mono), monospace" },
        }),
      ],
    });

    const view = new CMEditorView({
      state,
      parent: editorRef.current,
    });

    cmViewRef.current = view;

    return () => {
      view.destroy();
      cmViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftView]);

  // Sync content into CodeMirror when it changes externally (e.g. import)
  useEffect(() => {
    const cm = cmViewRef.current;
    if (!cm) return;
    const currentDoc = cm.state.doc.toString();
    if (currentDoc !== content) {
      cm.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: content },
      });
    }
  }, [content]);

  const doSave = useCallback(
    async (contentToSave: string) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      try {
        await saveSongAction(songId, lang, contentToSave);
        lastSavedRef.current = contentToSave;
        if (contentRef.current === contentToSave) {
          setSaved(true);
        }
      } catch (err) {
        console.error("Save failed:", err);
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [songId, lang],
  );

  const handleSave = useCallback(() => {
    doSave(contentRef.current);
  }, [doSave]);

  // Debounced autosave when content diverges from what's on disk
  useEffect(() => {
    if (!autoSave) return;
    if (savingRef.current) return;
    if (contentRef.current === lastSavedRef.current) return;

    const timer = setTimeout(() => {
      doSave(contentRef.current);
    }, 2000);

    return () => clearTimeout(timer);
  }, [content, autoSave, doSave, saved]);

  const handleToggleAutoSave = useCallback(() => {
    if (autoSave) {
      // Turning off: flush any pending changes before disabling
      if (contentRef.current !== lastSavedRef.current && !savingRef.current) {
        doSave(contentRef.current);
      }
      setAutoSave(false);
    } else {
      setAutoSave(true);
    }
  }, [autoSave, doSave]);

  // Warn when leaving with unsaved changes while autosave is off
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!autoSave && !saved && contentRef.current !== lastSavedRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [autoSave, saved]);

  const handleVisualChange = useCallback((newSource: string) => {
    setContent(newSource);
    setSaved(false);
  }, []);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      if (importTab === "pdf" && importFile) {
        const { pdfToChordPro } = await import("@/lib/chordpro/pdf-import");
        const result = await pdfToChordPro(importFile);
        if (result.chordpro) {
          setContent(result.chordpro);
          setSaved(false);
        }
      } else if (importTab === "word" && importFile) {
        const { docxToChordPro } = await import("@/lib/chordpro/docx-import");
        const result = await docxToChordPro(importFile);
        if (result.chordpro) {
          setContent(result.chordpro);
          setSaved(false);
        }
      } else if (importText.trim()) {
        const result = txtToChordPro(importText);
        setContent(result.chordpro);
        setSaved(false);
      }

      if (importRefText.trim()) {
        const refs = parseReferences(importRefText).map((r) => {
          const ref: Reference = { type: r.type, label: r.label, target: r.target };
          if (r.line !== undefined) ref.line = r.line;
          if (r.verse !== undefined) ref.verse = r.verse;
          if (r.chorus !== undefined) ref.chorus = r.chorus;
          if (r.text !== undefined) ref.text = r.text;
          if (r.highlight !== undefined) ref.highlight = r.highlight;
          if (r.locations !== undefined) ref.locations = r.locations;
          return ref;
        });
        saveSongReferencesAction(songId, refs);
      }
    } finally {
      setImporting(false);
      setShowImport(false);
      setImportText("");
      setImportRefText("");
      setImportRefs([]);
      setImportFile(null);
      setImportFileName(null);
      setImportTab("text");
    }
  }, [importText, importRefText, importFile, importTab, songId]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Editor pane */}
      <div
        className={`flex flex-col ${
          showCompare || leftView === "code"
            ? "w-1/2 border-r border-neutral-200 dark:border-neutral-800"
            : "flex-1"
        }`}
      >
        <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLeftView("visual")}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                leftView === "visual"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              {t('editor.visual')}
            </button>
            <button
              onClick={() => setLeftView("code")}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                leftView === "code"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              {t('editor.code')}
            </button>
            <button
              onClick={() => setCompareOn((on) => !on)}
              disabled={otherLangs.length === 0}
              title={otherLangs.length === 0 ? t('editor.compareNoOtherTranslation') : undefined}
              className={`text-xs px-2 py-0.5 rounded transition-colors disabled:opacity-40 ${
                compareOn
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              {t('editor.compare')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAutoSave}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                autoSave
                  ? "border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
              title={t('editor.autosaveToggleHint')}
            >
              {autoSave ? t('editor.autosaveOn') : t('editor.autosaveOff')}
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="text-xs px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('editor.importPaste')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? t('common.saving') : saved ? t('common.saved') : t('common.save')}
            </button>
          </div>
        </div>

        {/* Code editor */}
        {leftView === "code" && (
          <div ref={editorRef} className="flex-1 overflow-hidden" />
        )}

        {/* Visual editor */}
        {leftView === "visual" && (
          <div className="flex-1 overflow-auto p-4">
            <VisualChordEditor source={content} onChange={handleVisualChange} />
          </div>
        )}
      </div>

      {/* Preview pane (code mode only — visual mode is itself the view) */}
      {!showCompare && leftView === "code" && (
        <div className="w-1/2 flex flex-col">
          <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
            <span className="text-xs text-neutral-500 font-medium">{t('editor.preview')}</span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div
              className="visual-chord-editor visual-chord-sheet"
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          </div>
        </div>
      )}

      {/* Compare pane (another language, read mode, repeats not expanded) */}
      {showCompare && (
        <div className="w-1/2 flex flex-col">
          <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900">
            <div className="flex items-center gap-1">
              <label className="text-xs text-neutral-500 font-medium pr-1">{t('editor.compareWith')}</label>
              <select
                value={validCompareLang ?? ""}
                onChange={(e) => setCompareLang(e.target.value)}
                className="text-xs px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-950 outline-none"
                aria-label={t('editor.compareWith')}
              >
                {otherLangs.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCompareView("visual")}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  compareView === "visual"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }`}
              >
                {t('editor.visual')}
              </button>
              <button
                onClick={() => setCompareView("code")}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  compareView === "code"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }`}
              >
                {t('editor.code')}
              </button>
            </div>
          </div>
          {compareView === "visual" ? (
            <div className="flex-1 overflow-auto p-4">
              <div
                className="visual-chord-editor visual-chord-sheet"
                dangerouslySetInnerHTML={{ __html: comparePreview }}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <ReadOnlyChordSource source={compareSource} className="h-full" />
            </div>
          )}
        </div>
      )}

      {/* Import paste modal */}
      {showImport && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 bg-black/50">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-800 w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-lg">{t('editor.importPaste')}</h2>
              <button
                onClick={() => { setShowImport(false); setImportText(""); setImportRefText(""); setImportRefs([]); setImportFile(null); setImportFileName(null); }}
                className="text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>

            {/* Tab bar */}
            <div className="px-5 pt-3 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
              {(["text", "pdf", "word"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setImportTab(tab)}
                  className={`text-xs px-3 py-1.5 rounded-t border border-b-0 transition-colors ${
                    importTab === tab
                      ? "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-foreground font-semibold -mb-px"
                      : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  {t(`editor.importTab${tab.charAt(0).toUpperCase() + tab.slice(1)}` as any)}
                </button>
              ))}
            </div>

            <div className="p-5 flex-1 overflow-auto grid grid-cols-2 gap-4">
              {/* Left — import content */}
              <div className="flex flex-col gap-2">
                {importTab === "text" && (
                  <>
                    <p className="text-sm text-neutral-500">{t('editor.importPasteHint')}</p>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="w-full flex-1 min-h-[200px] p-3 border border-neutral-300 dark:border-neutral-700 rounded font-mono text-sm bg-white dark:bg-black resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('editor.importPastePlaceholder')}
                    />
                  </>
                )}
                {importTab === "pdf" && (
                  <>
                    <p className="text-sm text-neutral-500">{t('editor.importPDFHint')}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setImportFile(f);
                            setImportFileName(f.name);
                          }
                        }}
                        className="text-sm file:mr-3 file:py-1.5 file:px-3 file:border file:border-neutral-300 dark:file:border-neutral-700 file:rounded file:text-xs file:bg-white dark:file:bg-neutral-900 hover:file:bg-neutral-50 dark:hover:file:bg-neutral-800 file:cursor-pointer"
                      />
                    </div>
                    {importFileName && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {t('editor.importFileSelected', { name: importFileName })}
                      </p>
                    )}
                  </>
                )}
                {importTab === "word" && (
                  <>
                    <p className="text-sm text-neutral-500">{t('editor.importWordHint')}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <input
                        type="file"
                        accept=".docx"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setImportFile(f);
                            setImportFileName(f.name);
                          }
                        }}
                        className="text-sm file:mr-3 file:py-1.5 file:px-3 file:border file:border-neutral-300 dark:file:border-neutral-700 file:rounded file:text-xs file:bg-white dark:file:bg-neutral-900 hover:file:bg-neutral-50 dark:hover:file:bg-neutral-800 file:cursor-pointer"
                      />
                    </div>
                    {importFileName && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {t('editor.importFileSelected', { name: importFileName })}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Right column — references (text tab only) */}
              {importTab === "text" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-neutral-500">{t('editor.importRefHint')}</p>
                  <textarea
                    value={importRefText}
                    onChange={(e) => {
                      setImportRefText(e.target.value);
                      setImportRefs(parseReferences(e.target.value));
                    }}
                    className="w-full flex-1 min-h-[200px] p-3 border border-neutral-300 dark:border-neutral-700 rounded font-mono text-sm bg-white dark:bg-black resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('editor.importRefPlaceholder')}
                  />
                  {importRefs.length > 0 && (
                    <div className="text-xs text-neutral-500">
                      {t('editor.importRefCount', { count: importRefs.length })}
                      <ul className="mt-1 space-y-0.5">
                        {importRefs.map((ref, i) => (
                          <li key={i} className="truncate">
                            <span className="font-semibold">{ref.type}</span>
                            {" — "}{ref.label}
                            {ref.verse && <span className="text-neutral-400"> @ {ref.verse}</span>}
                            {ref.chorus && <span className="text-neutral-400"> @ {ref.chorus}</span>}
                            {ref.line && <span className="text-neutral-400"> @ line {ref.line}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-neutral-500">{t('editor.importRefHint')}</p>
                  <textarea
                    value={importRefText}
                    onChange={(e) => {
                      setImportRefText(e.target.value);
                      setImportRefs(parseReferences(e.target.value));
                    }}
                    className="w-full flex-1 min-h-[200px] p-3 border border-neutral-300 dark:border-neutral-700 rounded font-mono text-sm bg-white dark:bg-black resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('editor.importRefPlaceholder')}
                  />
                  {importRefs.length > 0 && (
                    <div className="text-xs text-neutral-500">
                      {t('editor.importRefCount', { count: importRefs.length })}
                      <ul className="mt-1 space-y-0.5">
                        {importRefs.map((ref, i) => (
                          <li key={i} className="truncate">
                            <span className="font-semibold">{ref.type}</span>
                            {" — "}{ref.label}
                            {ref.verse && <span className="text-neutral-400"> @ {ref.verse}</span>}
                            {ref.chorus && <span className="text-neutral-400"> @ {ref.chorus}</span>}
                            {ref.line && <span className="text-neutral-400"> @ line {ref.line}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => { setShowImport(false); setImportText(""); setImportRefText(""); setImportRefs([]); setImportFile(null); setImportFileName(null); }}
                className="text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleImport}
                disabled={
                  importing ||
                  (importTab === "text" ? !importText.trim() && !importRefText.trim() : !importFile)
                }
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {importing ? t('editor.importConverting') : t('editor.importConvert')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
