import { SECTION_TYPES } from "./chord-utils";

const SECTION_TYPES_RE = SECTION_TYPES.join("|");

export interface ChordPosition {
  chord: string;
  position: number;
}

export interface ParsedLine {
  type: "content" | "directive";
  raw: string;
  lyrics: string;
  chords: ChordPosition[];
}

export function parseChordProLine(line: string): ParsedLine {
  const trimmed = line.trim();
  if (trimmed.startsWith("{")) {
    return { type: "directive", raw: line, lyrics: "", chords: [] };
  }

  const chords: ChordPosition[] = [];
  let lyrics = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] === "[") {
      const close = line.indexOf("]", i);
      if (close === -1) {
        lyrics += line[i];
        i++;
      } else {
        const chordName = line.substring(i + 1, close);
        chords.push({ chord: chordName, position: lyrics.length });
        i = close + 1;
      }
    } else {
      lyrics += line[i];
      i++;
    }
  }

  return { type: "content", raw: line, lyrics, chords };
}

export function parseChordProSource(source: string): ParsedLine[] {
  return source.split("\n").map(parseChordProLine);
}

export function directiveLabel(raw: string): string | null {
  const m = raw
    .trim()
    .match(
      new RegExp(
        `^\\{(?:start_of_|s)(${SECTION_TYPES_RE})(?:\\s*:\\s*(.+?))?\\}$`,
        "i"
      )
    );
  if (m) {
    const label = m[2] || m[1].replace(/^\w/, (c) => c.toUpperCase());
    return label;
  }
  if (
    new RegExp(`^\\{(?:end_of_|e)(${SECTION_TYPES_RE})\\}$`, "i").test(
      raw.trim()
    )
  ) {
    return null;
  }
  return null;
}

export function lineToChordPro(parsed: ParsedLine): string {
  if (parsed.type === "directive") return parsed.raw;

  const { lyrics, chords } = parsed;
  if (chords.length === 0) return lyrics;

  const sorted = [...chords].sort((a, b) => b.position - a.position);
  let result = lyrics;
  for (const c of sorted) {
    const pos = Math.min(c.position, result.length);
    result = result.slice(0, pos) + `[${c.chord}]` + result.slice(pos);
  }
  return result;
}

export function linesToChordPro(lines: ParsedLine[]): string {
  return lines.map(lineToChordPro).join("\n");
}

/**
 * Whether a parsed line counts as a song content line. Directives and
 * whitespace-only lines are not content; lyric lines and chord-only lines are.
 * This matches the content-line indexing used by ChordSheet (parseSectionMap),
 * so reference `line` numbers stay consistent.
 */
export function isContentLine(pl: ParsedLine): boolean {
  return pl.type === "content" && (pl.lyrics.trim() !== "" || pl.chords.length > 0);
}

export interface SectionSpan {
  type: string;
  label: string;
  startLine: number; // first content-line index in the section
  endLine: number; // last content-line index in the section
}

/**
 * Map each verse/chorus/bridge section to the content-line span it covers.
 * Content lines are indexed the same way as ChordSheet's parseSectionMap.
 */
export function buildSectionSpans(source: string): SectionSpan[] {
  const spans: SectionSpan[] = [];
  const stack: { type: string; label: string; startLine: number }[] = [];
  let contentLine = 0;

  const popSection = (endLine: number) => {
    const cur = stack.pop();
    if (cur) {
      spans.push({ ...cur, endLine: Math.max(cur.startLine, endLine) });
    }
  };

  for (const pl of parseChordProSource(source)) {
    if (pl.type === "directive") {
      const raw = pl.raw.trim();
      const start = raw.match(
        new RegExp(
          `^\\{(?:start_of_|s)(${SECTION_TYPES_RE})(?:\\s*:\\s*(.+?))?\\}$`,
          "i"
        )
      );
      const end = raw.match(
        new RegExp(`^\\{(?:end_of_|e)(${SECTION_TYPES_RE})\\}$`, "i")
      );
      if (start) {
        const type = start[1].toLowerCase();
        const label = start[2] || type.charAt(0).toUpperCase() + type.slice(1);
        stack.push({ type, label, startLine: contentLine });
      } else if (end && stack.length > 0) {
        popSection(contentLine - 1);
      }
      continue;
    }
    if (isContentLine(pl)) contentLine++;
  }

  while (stack.length > 0) popSection(contentLine - 1);
  return spans;
}

/**
 * Find the section that contains a given content-line index.
 * Returns the outermost matching section, or null if the line is
 * outside every section (preamble/trailing lines).
 */
export function sectionForLine(
  spans: SectionSpan[],
  line: number
): { type: string; label: string } | null {
  for (const s of spans) {
    if (line >= s.startLine && line <= Math.max(s.startLine, s.endLine)) {
      return { type: s.type, label: s.label };
    }
  }
  return null;
}