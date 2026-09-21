import ChordSheetJS from 'chordsheetjs';
import { renderVisualChordSheet } from './visual-render';
import { getReferenceText, getHighlight } from '@/lib/content/references';

/**
 * Parse a ChordPro source string into a ChordSheetJS Song object.
 */
export function parseChordPro(source: string) {
  const parser = new ChordSheetJS.ChordProParser();
  return parser.parse(source);
}

/**
 * Render a ChordPro source string to HTML using the same
 * character-aligned layout as the visual editor.
 */
export function renderToHtml(source: string): string {
  return renderVisualChordSheet(source, { repeatChorus: true });
}

/**
 * Transpose a ChordPro source string by the given number of semitones
 * and return the new ChordPro text.
 */
export function transpose(source: string, semitones: number): string {
  const song = parseChordPro(source);
  const transposed = song.transpose(semitones);
  const formatter = new ChordSheetJS.ChordProFormatter();
  return formatter.format(transposed);
}

/**
 * Extract the key from a ChordPro source string.
 * Looks for the {key: ...} directive in the song metadata.
 */
export function getKey(source: string): string | null {
  const song = parseChordPro(source);
  return song.key ?? null;
}

/**
 * Render references as HTML for print view.
 */
export function renderReferencesHtml(
  references: { type: string; label: string; target: string; text?: string; texts?: Record<string, string>; highlight?: string; highlights?: Record<string, string> }[],
  lang = 'en'
): string {
  if (references.length === 0) return '';
  const items = references
    .map((r) => {
      let link: string;
      if (r.type === 'song') {
        link = `<a href="/songs/${escapeHtml(r.target)}">${escapeHtml(r.label)}</a>`;
      } else if (r.type === 'link') {
        link = `<a href="${escapeHtml(r.target)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.label)}</a>`;
      } else {
        link = escapeHtml(r.label);
      }
      const text = getReferenceText(r, lang);
      const hl = getHighlight(r, lang);
      let textHtml = '';
      if (text) {
        textHtml = `<div class="ref-text">${renderHighlightedHtml(text, hl)}</div>`;
      }
      return `<li>${link}${textHtml}</li>`;
    })
    .join('\n');
  return `<div class="song-references"><div class="ref-header">References</div><ul>${items}</ul></div>`;
}

function renderHighlightedHtml(text: string, highlight?: string): string {
  if (!highlight) return escapeHtml(text);
  const index = text.indexOf(highlight);
  if (index === -1) return escapeHtml(text);
  const before = escapeHtml(text.slice(0, index));
  const marked = escapeHtml(highlight);
  const after = escapeHtml(text.slice(index + highlight.length));
  return `${before}<mark>${marked}</mark>${after}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
