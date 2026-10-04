/**
 * Shared print stylesheet used by every printable page (album/artist/song
 * book, setlists). Imported as a raw string so server components can inject
 * it via <style> without additional CSS infrastructure.
 */
export const printStyles = `
  @media print {
    .no-print { display: none !important; }
    header { display: none !important; }
    .song-page { page-break-after: auto; break-inside: avoid; }
    .song-page:last-child { page-break-after: auto; }
    .toc-print { page-break-after: always; }
    @page { margin: 1.5cm; size: A4; }
    /* Two-column layout for book mode */
    .print-columns {
      column-count: 2;
      column-gap: 1.5cm;
      column-fill: auto;
    }
    .print-columns .song-page {
      page-break-after: auto;
      break-inside: avoid;
      column-break-inside: avoid;
      border: none;
    }
    .print-columns .album-header {
      column-span: all;
      page-break-before: always;
      break-before: column;
    }
    /* Remove borders from song pages */
    .song-page {
      border: none;
      padding: 0;
      margin-bottom: 1em;
    }
    .song-page h2 {
      border-bottom: 1px solid #ccc;
      padding-bottom: 0.3em;
      margin-bottom: 0.5em;
    }
    .song-page:last-child {
      page-break-after: auto;
    }
    /* Chord sheet - responsive like mobile web version */
    .visual-chord-editor.visual-chord-sheet {
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
    }
    .visual-chord-sheet .vce-lines {
      width: 100%;
    }
    .visual-chord-sheet .vce-line {
      width: 100%;
      min-width: 0;
      border: none;
    }
    /* Allow lyrics to wrap in print */
    .visual-chord-sheet .vce-lyrics-text {
      font-size: 9pt;
      line-height: 1.5;
      min-height: 1.5em;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      padding: 0 0.15em;
      border: none;
      background: transparent;
    }
    /* Chords row - allow wrapping, smaller font */
    .visual-chord-sheet .vce-chord-row {
      font-size: 8pt;
      min-height: 1.5em;
      line-height: 1.5em;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      overflow-x: hidden;
      border: none;
    }
    .visual-chord-sheet .vce-chord {
      display: inline-block;
      white-space: nowrap;
    }
    .visual-chord-sheet .vce-chord-space {
      display: inline-block;
    }
    .visual-chord-sheet .vce-section-label {
      font-size: 7pt;
      padding: 0.1em 0.4em;
      margin-top: 0.5em;
    }
    .visual-chord-sheet .vce-empty-line {
      height: 0.75em;
    }
    /* Inline chords (mobile/PDF responsive) */
    .visual-chord-sheet .vce-inline-chords-line {
      display: block;
    }
    .visual-chord-sheet .vce-inline-chord {
      color: #2563eb;
      font-weight: 700;
      font-size: 0.9em;
      background: #eff6ff;
      padding: 0 0.15em;
      border-radius: 2px;
      margin-right: 0.1em;
      white-space: nowrap;
    }
    @media (prefers-color-scheme: dark) {
      .visual-chord-sheet .vce-inline-chord {
        color: #60a5fa;
        background: #1e3a5f;
      }
    }
    .song-references { margin-top: 1em; padding-top: 0.75em; border-top: 1px solid #ccc; }
    .song-references .ref-header { font-size: 0.7em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 0.3em; }
    .song-references ul { list-style: disc; padding-left: 1.2em; font-size: 0.85em; }
    .song-references li { margin-bottom: 0.3em; }
    .song-references a { color: #333; text-decoration: none; }
    .song-references .ref-text { margin-top: 0.2em; font-style: italic; font-size: 0.9em; color: #555; padding-left: 0.5em; border-left: 2px solid #ccc; }
    .song-references mark { background: #fef3c7; color: #92400e; padding: 0 0.15em; border-radius: 2px; }
  }
  @media screen {
    .song-references { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-neutral-200); }
    .song-references .ref-header { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-neutral-400); margin-bottom: 0.5rem; }
    .song-references ul { list-style: disc; padding-left: 1.2rem; font-size: 0.85rem; }
    .song-references li { margin-bottom: 0.4rem; }
    .song-references a { color: var(--color-blue-600); }
    .song-references .ref-text { margin-top: 0.25rem; font-style: italic; font-size: 0.85em; color: var(--color-neutral-500); padding-left: 0.5rem; border-left: 2px solid var(--color-neutral-200); line-height: 1.5; }
    .song-references mark { background: #fef3c7; color: #92400e; padding: 0 0.15em; border-radius: 2px; }
  }
`;