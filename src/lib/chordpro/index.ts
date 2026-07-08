import ChordSheetJS from 'chordsheetjs';

/**
 * Parse a ChordPro source string into a ChordSheetJS Song object.
 */
export function parseChordPro(source: string) {
  const parser = new ChordSheetJS.ChordProParser();
  return parser.parse(source);
}

/**
 * Render a ChordPro source string to HTML using HtmlDivFormatter.
 */
export function renderToHtml(source: string): string {
  const song = parseChordPro(source);
  const formatter = new ChordSheetJS.HtmlDivFormatter();
  return formatter.format(song);
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
