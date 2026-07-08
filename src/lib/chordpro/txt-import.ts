/**
 * Convert plain-text chord/lyric formats to ChordPro.
 *
 * Supports the two most common TXT conventions:
 *
 * 1. **Chords-above-lyrics** – alternating lines where a "chord line" contains
 *    only chords (A-G, sharps/flats, suffixes like m, 7, sus4 …) separated by
 *    spaces, and the next line is the corresponding lyric line.
 *
 * 2. **Inline bracket chords** – lyrics already contain chords in [brackets],
 *    which is essentially ChordPro already. We normalise section headers.
 *
 * Section headers like "Verse 1:", "Chorus:", "Bridge:" etc. are converted to
 * ChordPro {start_of_verse}/{start_of_chorus}/{start_of_bridge} directives.
 */

// Matches a line that is entirely chords (with spaces between them)
// Chord pattern: optional root note A-G, optional sharp/flat, optional suffix
const CHORD_TOKEN =
  /^[A-Ga-g][b#]?(?:m|min|maj|dim|aug|sus[24]?|add\d{1,2}|M?\d{1,2}|\/[A-Ga-g][b#]?)*$/;

function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // A chord line is made of tokens that all look like chords
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;
  return tokens.every((t) => CHORD_TOKEN.test(t));
}

// Matches common section headers: "Verse 1:", "[Chorus]", "-- Bridge --", etc.
const SECTION_HEADER =
  /^\s*(?:\[?\s*|--?\s*)(verse|chorus|bridge|pre[- ]?chorus|intro|outro|interlude|tag|coda|instrumental)(?:\s*(\d+))?\s*(?:\]?\s*|--?\s*)[:.\-]*\s*$/i;

type SectionType = "verse" | "chorus" | "bridge";

function detectSectionType(label: string): SectionType {
  const lower = label.toLowerCase();
  if (lower.includes("chorus")) return "chorus";
  if (lower.includes("bridge")) return "bridge";
  return "verse";
}

/**
 * Merge a chord line with the lyric line below it, inserting [Chord] markers
 * at the correct character positions.
 */
function mergeChordAndLyricLine(
  chordLine: string,
  lyricLine: string
): string {
  // Find each chord and its column position
  const chords: { col: number; chord: string }[] = [];
  const re = /\S+/g;
  let match;
  while ((match = re.exec(chordLine)) !== null) {
    chords.push({ col: match.index, chord: match[0] });
  }

  if (chords.length === 0) return lyricLine;

  // Walk through the lyric line, inserting [chord] at each position
  // We need to pad the lyric line if chords extend beyond it
  const padded = lyricLine.padEnd(
    Math.max(lyricLine.length, chords[chords.length - 1].col + 1)
  );

  let result = "";
  let lastIdx = 0;

  for (const { col, chord } of chords) {
    // Add lyric text before this chord position
    if (col > lastIdx) {
      result += padded.slice(lastIdx, col);
    } else if (col < lastIdx) {
      // Chord overlaps — just append it
    }
    result += `[${chord}]`;
    lastIdx = Math.max(lastIdx, col);
  }

  // Add remaining lyric text
  if (lastIdx < padded.length) {
    result += padded.slice(lastIdx);
  }

  return result.trimEnd();
}

/**
 * Detect if text already contains inline [Chord] notation.
 */
function hasInlineChords(text: string): boolean {
  // Look for patterns like [Am], [G7], [C#m] within lines that also have lyrics
  return /\[[A-Ga-g][b#]?[^[\]]*\]/.test(text);
}

/**
 * Extract title from the first non-empty, non-section-header line,
 * or from a "Title:" prefix.
 */
function extractTitle(lines: string[]): string | null {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // "Title: Something"
    const titleMatch = trimmed.match(/^title\s*[:=]\s*(.+)$/i);
    if (titleMatch) return titleMatch[1].trim();

    // Skip section headers and chord lines
    if (SECTION_HEADER.test(trimmed)) continue;
    if (isChordLine(trimmed)) continue;

    // First real text line could be the title
    // Only if it doesn't contain chord brackets
    if (!hasInlineChords(trimmed)) {
      return trimmed;
    }
    break;
  }
  return null;
}

/**
 * Convert a plain-text song file to ChordPro format.
 */
export function txtToChordPro(input: string): {
  title: string | null;
  chordpro: string;
  detectedKey: string | null;
} {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let currentSection: SectionType | null = null;
  let sectionOpen = false;
  let detectedKey: string | null = null;
  let title: string | null = null;

  // Check if this is already inline-chord format
  const alreadyInline = hasInlineChords(input);

  // Try to extract a title
  title = extractTitle(lines);

  // Look for key indication
  for (const line of lines) {
    const keyMatch = line.trim().match(/^key\s*[:=]\s*([A-Ga-g][b#]?m?)\s*$/i);
    if (keyMatch) {
      detectedKey = keyMatch[1];
      break;
    }
  }

  if (title) {
    output.push(`{title: ${title}}`);
  }
  if (detectedKey) {
    output.push(`{key: ${detectedKey}}`);
  }
  if (title || detectedKey) {
    output.push("");
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip title/key metadata lines we already processed
    if (/^title\s*[:=]/i.test(trimmed) || /^key\s*[:=]/i.test(trimmed)) {
      i++;
      continue;
    }

    // Check for section header
    const sectionMatch = trimmed.match(SECTION_HEADER);
    if (sectionMatch) {
      // Close previous section
      if (sectionOpen) {
        const endTag =
          currentSection === "chorus"
            ? "end_of_chorus"
            : currentSection === "bridge"
            ? "end_of_bridge"
            : "end_of_verse";
        output.push(`{${endTag}}`);
        output.push("");
      }

      const sectionName = sectionMatch[1];
      const sectionNum = sectionMatch[2] || "";
      currentSection = detectSectionType(sectionName);

      const startTag =
        currentSection === "chorus"
          ? "start_of_chorus"
          : currentSection === "bridge"
          ? "start_of_bridge"
          : "start_of_verse";

      const label =
        sectionName.charAt(0).toUpperCase() +
        sectionName.slice(1).toLowerCase() +
        (sectionNum ? ` ${sectionNum}` : "");

      output.push(`{${startTag}: ${label}}`);
      sectionOpen = true;
      i++;
      continue;
    }

    // Empty line — could be section boundary
    if (!trimmed) {
      // If no explicit section headers are used, close/open sections on blank lines
      if (sectionOpen) {
        const endTag =
          currentSection === "chorus"
            ? "end_of_chorus"
            : currentSection === "bridge"
            ? "end_of_bridge"
            : "end_of_verse";
        output.push(`{${endTag}}`);
        output.push("");
        sectionOpen = false;
        currentSection = null;
      } else {
        output.push("");
      }
      i++;
      continue;
    }

    if (alreadyInline) {
      // Already has inline chords — pass through, just auto-open a section if needed
      if (!sectionOpen) {
        output.push("{start_of_verse}");
        sectionOpen = true;
        currentSection = "verse";
      }
      output.push(trimmed);
      i++;
      continue;
    }

    // Chords-above-lyrics format
    if (isChordLine(trimmed)) {
      const chordLine = line; // preserve original spacing for column positions
      const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
      const nextTrimmed = nextLine.trim();

      // Auto-open a section if none is open
      if (!sectionOpen) {
        output.push("{start_of_verse}");
        sectionOpen = true;
        currentSection = "verse";
      }

      // If next line is also a chord line or empty, this is a chords-only line
      if (!nextTrimmed || isChordLine(nextTrimmed) || SECTION_HEADER.test(nextTrimmed)) {
        // Chords-only line (e.g. instrumental)
        const chords = trimmed.split(/\s+/);
        output.push(chords.map((c) => `[${c}]`).join(" "));
        i++;
      } else {
        // Merge chord line with lyric line below
        const merged = mergeChordAndLyricLine(chordLine, nextLine);
        output.push(merged);
        i += 2;
      }
      continue;
    }

    // Plain lyric line (no chords above)
    if (!sectionOpen) {
      // Skip the first non-chord, non-section line if it matches the detected title
      if (title && trimmed === title && output.some((l) => l.startsWith("{title:"))) {
        i++;
        continue;
      }
      output.push("{start_of_verse}");
      sectionOpen = true;
      currentSection = "verse";
    }
    output.push(trimmed);
    i++;
  }

  // Close any remaining open section
  if (sectionOpen) {
    const endTag =
      currentSection === "chorus"
        ? "end_of_chorus"
        : currentSection === "bridge"
        ? "end_of_bridge"
        : "end_of_verse";
    output.push(`{${endTag}}`);
  }

  return {
    title,
    chordpro: output.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    detectedKey,
  };
}
