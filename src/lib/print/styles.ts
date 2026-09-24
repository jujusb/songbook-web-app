/**
 * Shared print stylesheet used by every printable page (album/artist/song
 * book, setlists). Imported as a raw string so server components can inject
 * it via <style> without additional CSS infrastructure.
 */
export const printStyles = `
  @media print {
    .no-print { display: none !important; }
    header { display: none !important; }
    .song-page { page-break-after: always; }
    .song-page:last-child { page-break-after: auto; }
    .toc-print { page-break-after: always; }
    @page { margin: 2cm; size: A4; }
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