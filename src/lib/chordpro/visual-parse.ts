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
    .match(/^\{(?:start_of_|s)(verse|chorus|bridge)(?:\s*:\s*(.+?))?\}$/i);
  if (m) {
    const label = m[2] || m[1].replace(/^\w/, (c) => c.toUpperCase());
    return label;
  }
  if (/^\{(?:end_of_|e)(verse|chorus|bridge)\}$/i.test(raw.trim())) return null;
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