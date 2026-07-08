"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView as CMEditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import ChordSheetJS from "chordsheetjs";
import { saveSongAction } from "@/app/actions";
import { VisualChordEditor } from "@/components/VisualChordEditor";

function renderChordPro(source: string): string {
  try {
    const parser = new ChordSheetJS.ChordProParser();
    const song = parser.parse(source);
    const formatter = new ChordSheetJS.HtmlDivFormatter({ expandChorusDirective: true });
    return formatter.format(song);
  } catch {
    return "<p class='text-red-500'>Parse error</p>";
  }
}

type EditorMode = "code" | "visual";

export function EditorView({
  songId,
  lang,
  initialContent,
}: {
  songId: string;
  lang: string;
  initialContent: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const cmViewRef = useRef<CMEditorView | null>(null);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<EditorMode>("visual");

  const preview = renderChordPro(content);

  // Initialize CodeMirror when switching to code mode
  useEffect(() => {
    if (mode !== "code") return;
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
  }, [mode]);

  // Sync content into CodeMirror when switching to code mode
  // (handled by re-creating the editor with current content above)

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveSongAction(songId, lang, content);
      setSaved(true);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [songId, lang, content]);

  const handleVisualChange = useCallback((newSource: string) => {
    setContent(newSource);
    setSaved(false);
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Editor pane */}
      <div className="w-1/2 flex flex-col border-r border-neutral-200 dark:border-neutral-800">
        <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode("visual")}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                mode === "visual"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => setMode("code")}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                mode === "code"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              Code
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save"}
          </button>
        </div>

        {/* Code editor */}
        {mode === "code" && (
          <div ref={editorRef} className="flex-1 overflow-hidden" />
        )}

        {/* Visual editor */}
        {mode === "visual" && (
          <div className="flex-1 overflow-auto p-4">
            <VisualChordEditor source={content} onChange={handleVisualChange} />
          </div>
        )}
      </div>

      {/* Preview pane */}
      <div className="w-1/2 flex flex-col">
        <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <span className="text-xs text-neutral-500 font-medium">PREVIEW</span>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div
            className="chord-sheet"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </div>
    </div>
  );
}
