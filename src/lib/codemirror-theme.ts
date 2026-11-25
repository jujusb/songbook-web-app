import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

/**
 * Whether the OS/browser currently asks for dark mode. Mirrors the
 * `prefers-color-scheme` media query used in globals.css.
 */
export function isDarkMode(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/**
 * Editor chrome + syntax highlighting that matches the app's light/dark theme.
 * The default CodeMirror highlight style is designed for white backgrounds, so
 * in dark mode we drop it and let the text inherit the page foreground colour.
 */
export function songbookEditorTheme(
  dark: boolean = isDarkMode(),
): Extension[] {
  const colors = dark
    ? {
        text: "var(--foreground)",
        gutterText: "#6b7280",
        border: "#374151",
        activeLine: "rgba(255, 255, 255, 0.04)",
        activeGutter: "rgba(255, 255, 255, 0.06)",
        selection: "#1e3a5f",
        caret: "#ededed",
        panelBg: "#1f2937",
      }
    : null;

  const theme = EditorView.theme(
    {
      "&": {
        height: "100%",
        fontSize: "14px",
        ...(dark ? { backgroundColor: "transparent", color: colors!.text } : {}),
      },
      ".cm-scroller": { overflow: "auto" },
      ".cm-content": { fontFamily: "var(--font-geist-mono), monospace" },
      ...(dark
        ? {
            ".cm-content": {
              fontFamily: "var(--font-geist-mono), monospace",
              caretColor: colors!.caret,
            },
            ".cm-cursor, .cm-dropCursor": { borderLeftColor: colors!.caret },
            ".cm-gutters": {
              backgroundColor: "transparent",
              color: colors!.gutterText,
              borderRight: `1px solid ${colors!.border}`,
            },
            ".cm-activeLine": { backgroundColor: colors!.activeLine },
            ".cm-activeLineGutter": {
              backgroundColor: colors!.activeGutter,
              color: colors!.text,
            },
            ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
              backgroundColor: colors!.selection,
            },
            ".cm-panels": {
              backgroundColor: colors!.panelBg,
              color: colors!.text,
            },
            ".cm-tooltip": {
              backgroundColor: colors!.panelBg,
              color: colors!.text,
              borderColor: colors!.border,
            },
          }
        : {}),
    },
    { dark },
  );

  return dark ? [theme] : [theme, syntaxHighlighting(defaultHighlightStyle)];
}
