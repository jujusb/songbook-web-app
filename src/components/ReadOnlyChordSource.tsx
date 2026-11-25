"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView as CMEditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { songbookEditorTheme } from "@/lib/codemirror-theme";

export function ReadOnlyChordSource({
  source,
  className = "",
}: {
  source: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<CMEditorView | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const state = EditorState.create({
      doc: source,
      extensions: [
        markdown(),
        ...songbookEditorTheme(),
        EditorState.readOnly.of(true),
        CMEditorView.editable.of(false),
        CMEditorView.lineWrapping,
      ],
    });

    const view = new CMEditorView({ state, parent: ref.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== source) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: source },
      });
    }
  }, [source]);

  return <div ref={ref} className={`overflow-hidden ${className}`} />;
}