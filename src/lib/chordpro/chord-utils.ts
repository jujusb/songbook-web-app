/**
 * Shared helpers for importing plain-text / Word / PDF chord sheets and for
 * normalising section directives across the app.
 */

// Strips diacritics so names like "Introducción" or "pré-refrain" match cleanly.
export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Chord pattern: optional root note A-G, optional accidental, optional suffix.
const BASE_CHORD_PATTERN =
  /^[A-Ga-g][b#]?(?:m|min|maj|dim|aug|sus[24]?|add\d{1,2}|M?\d{1,2}|\/[A-Ga-g][b#]?)*$/;

/**
 * Normalise a chord token. Handles a common transcription quirk where the
 * accidental is written after the quality (e.g. "Fm#" → "F#m", "Cm#" → "C#m").
 */
export function normalizeChord(token: string): string {
  const t = token.trim();
  const swapped = t.match(
    /^([A-Ga-g])(m|min|maj|dim|aug|sus[24]?|add\d{1,2}|M?\d{1,2})([b#])$/
  );
  if (swapped) return swapped[1] + swapped[3] + swapped[2];
  return t;
}

export function isChordToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  return BASE_CHORD_PATTERN.test(normalizeChord(t));
}

/** True when the line consists only of chord tokens separated by spaces. */
export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;
  return tokens.every((t) => isChordToken(t));
}

/**
 * Canonical ChordPro section directives produced by the importers.
 * Kept in sync with the renderers' section-type regexes.
 */
export const SECTION_TYPES = [
  "verse",
  "chorus",
  "bridge",
  "prechorus",
  "intro",
  "outro",
  "instrumental",
  "interlude",
  "coda",
  "tag",
] as const;

/**
 * Section name (in English, Spanish or French) → canonical directive.
 * Names are stored lowercase and accent-free.
 */
const SECTION_DIRECTIVE_BY_NAME: Record<string, string> = {
  // English / French shared
  verse: "verse",
  verses: "verse",
  chorus: "chorus",
  choruses: "chorus",
  refrain: "chorus",
  refrains: "chorus",
  bridge: "bridge",
  prechorus: "prechorus",
  intro: "instrumental",
  introduction: "instrumental",
  instrumental: "instrumental",
  interlude: "interlude",
  outro: "outro",
  coda: "coda",
  tag: "tag",
  // Spanish
  verso: "verse",
  versos: "verse",
  estrofa: "verse",
  estrofas: "verse",
  coro: "chorus",
  coros: "chorus",
  estribillo: "chorus",
  estribillos: "chorus",
  puente: "bridge",
  precoro: "prechorus",
  introduccion: "intro",
  interludio: "interlude",
  intermedio: "interlude",
  // French
  couplet: "verse",
  couplets: "verse",
  pont: "bridge",
  prerefrain: "prechorus",
};

export function mapSectionDirective(name: string): string | null {
  const key = stripAccents(name.toLowerCase()).replace(/[\s'\-]+/g, "");
  if (SECTION_DIRECTIVE_BY_NAME[key]) return SECTION_DIRECTIVE_BY_NAME[key];
  // "(Estribillo final)", "Verse finale" → match the bare section stem
  const stem = key.replace(/(final|finale|ultimos?|ultimas?|last)$/, "");
  return SECTION_DIRECTIVE_BY_NAME[stem] ?? null;
}

/**
 * Title-case an all-lowercase or all-uppercase section label (e.g. "INTRO" →
 * "Intro") while leaving mixed-case labels (e.g. "Estribillo", "Pre-Chorus")
 * untouched.
 */
export function prettifyLabel(name: string): string {
  const n = name.replace(/\s+/g, " ").trim();
  if (!n) return n;
  if (n === n.toUpperCase()) {
    return n.charAt(0) + n.slice(1).toLowerCase();
  }
  if (n === n.toLowerCase()) {
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  return n;
}

export interface ParsedSectionHeader {
  /** Canonical directive: verse | chorus | bridge | intro | … */
  directive: string;
  /** Display label, e.g. "Estribillo 2" or "Refrain". */
  name: string;
  /** Trailing section number ("2"), or "" when absent. */
  num: string;
  /** Inline content after a colon, e.g. "A  E  D" from "INTRO: A E D". */
  content?: string;
}

// Matches a section name (letters, with spaces/hyphens/apostrophes), an
// optional trailing number, and an optional ": content". Trailing closing
// Characters (parens, brackets, dashes, periods) are allowed so headers like
// "(Estribillo)", "[Chorus]" or "-- Bridge --" match after their opening
// punctuation has been stripped. Trailing parenthesised suffixes such as
// "(Estribillo) (DIOS)" are captured (including the first group's closing
// paren) and kept in the section label.
const SECTION_HEADER_NAME_RE =
  /^([a-zA-Z\u00C0-\u024F]+(?:[\s'\-][a-zA-Z\u00C0-\u024F]+)*)((?:\s*\)?\s*\([^)\n]+\))*)(?:\s*(\d+))?((?:\s*\)?\s*\([^)\n]+\))*)\s*(?::\s*([\s\S]*?))?[)\]}\-* .]*\s*$/;

/**
 * Parse a line as a section header. Handles:
 *   - emoji/bullet/dash prefixes: "🎸INTRO: A E D", "-- Bridge --", "► Coro"
 *   - wrapped labels: "(Estribillo)", "[Chorus]", "{Refrain}"
 *   - numbered labels: "Verse 2", "Couplet 1", "Coro (2x)"
 *   - inline content: "🎸INTRO: A  E  D  F#m  E  A"
 *   - multi-language names (see SECTION_DIRECTIVE_BY_NAME)
 *
 * Returns null when the line is not (or does not start with) a known section.
 */
export function parseSectionHeader(line: string): ParsedSectionHeader | null {
  let t = line.trim();
  if (!t) return null;

  // Strip a leading run of non-word/non-space characters: emoji (🎸, 👧🏼),
  // bullets (•), opening brackets/parens, dashes, etc.
  t = t.replace(/^[^\w\s]+/, "").trim();
  if (!t) return null;

  const m = t.match(SECTION_HEADER_NAME_RE);
  if (!m) return null;

  const directive = mapSectionDirective(m[1]);
  if (!directive) return null;

  const base = prettifyLabel(m[1]);
  const suffix = ((m[2] || "") + (m[4] || "")).replace(/^\s*\)\s*/, "").trim();
  const num = m[3] || "";
  const name = [base, num ? ` ${num}` : "", suffix ? ` ${suffix}` : ""]
    .join("")
    .trim();
  const content = m[5] !== undefined ? m[5].trim() : undefined;

  return { directive, name, num, content };
}

// Strip a leading numbering prefix from a title: "1. Title", "1) Title",
// "1 - Title", "1 Title".
const TITLE_NUMBER_PREFIX_RE = /^\d{1,3}\s*[.)\-\u2013\u2014\u2015]\s*/;

export function stripTitleNumber(s: string): string {
  return s.replace(TITLE_NUMBER_PREFIX_RE, "").trim();
}

// A standalone scripture citation line, e.g. "Lc 1,47", "Jn 3,16", "Sal 23".
const CITATION_RE =
  /^[a-zA-Z\u00C0-\u024F]{1,10}\.?\s*\d{1,3}(?:\s*[,:.\-\u2013]\s*\d{1,3})*\s*$/;

export function isCitationLine(line: string): boolean {
  return CITATION_RE.test(line.trim());
}