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

function sectionDirective(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "verse") return "verse";
  if (lower === "chorus") return "chorus";
  if (lower === "bridge") return "bridge";
  return lower; // intro, outro, interlude, coda, instrumental, etc.
}

/**
 * Merge a chord line with the lyric line below it, inserting [Chord] markers
 * at the correct character positions. When chord positions overshoot the
 * lyric length (e.g. from Word tab stops), distributes chords proportionally.
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

  const lyricLen = lyricLine.length;
  const lastChord = chords[chords.length - 1];
  const chordSpan = lastChord.col + lastChord.chord.length;

  // Preserve leading indent of the lyric line for alignment
  const leadingSpace = lyricLine.match(/^\s*/)?.[0].length ?? 0;

  if (chordSpan <= lyricLen) {
    // Chord positions fit within lyric — use exact column mapping
    // but snap each chord to the nearest word start so Word tab-stop
    // imports land on syllable boundaries instead of mid-word.
    const wordStarts: number[] = [];
    const wordRe = /\S+/g;
    let wm;
    while ((wm = wordRe.exec(lyricLine)) !== null) {
      wordStarts.push(wm.index);
    }

    let result = "";
    let lastIdx = 0;

    for (const { col, chord } of chords) {
      // Snap to nearest word start (handles Word's irregular spacing)
      const snapPos = snapToWordStart(col, wordStarts, lyricLen);
      if (snapPos > lastIdx) {
        result += lyricLine.slice(lastIdx, snapPos);
      }
      result += `[${chord}]`;
      lastIdx = snapPos;
    }

    if (lastIdx < lyricLen) {
      result += lyricLine.slice(lastIdx);
    }
    return result.trimEnd();
  }

  // Chord positions overshoot lyric length (Word tab stops) —
  // distribute chords proportionally across the lyric line,
  // aligning each chord to the nearest word start.
  const wordStarts: number[] = [];
  const wordRe = /\S+/g;
  let wm;
  while ((wm = wordRe.exec(lyricLine)) !== null) {
    wordStarts.push(wm.index);
  }

  let result = "";
  let lastIdx = 0;

  for (let ci = 0; ci < chords.length; ci++) {
    const { col, chord } = chords[ci];

    // Proportional position in the lyric line
    const ratio = chordSpan > 0 ? col / chordSpan : ci / chords.length;
    let targetPos = Math.round(ratio * lyricLen);
    targetPos = Math.max(leadingSpace, Math.min(targetPos, lyricLen));

    // Snap to nearest word start
    if (wordStarts.length > 0) {
      targetPos = snapToWordStart(targetPos, wordStarts, lyricLen);
    }

    if (targetPos > lastIdx) {
      result += lyricLine.slice(lastIdx, targetPos);
    }
    result += `[${chord}]`;
    lastIdx = targetPos;
  }

  if (lastIdx < lyricLen) {
    result += lyricLine.slice(lastIdx);
  }
  return result.trimEnd();
}

function snapToWordStart(pos: number, wordStarts: number[], lyricLen: number): number {
  if (wordStarts.length === 0) return pos;
  let nearest = wordStarts[0];
  let minDist = Math.abs(pos - nearest);
  for (let i = 1; i < wordStarts.length; i++) {
    const dist = Math.abs(pos - wordStarts[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = wordStarts[i];
    }
  }
  return nearest;
}

/**
 * Detect if text already contains inline [Chord] notation.
 */
function hasInlineChords(text: string): boolean {
  // Look for patterns like [Am], [G7], [C#m] within lines that also have lyrics
  if (/\[[A-Ga-g][b#]?[^[\]]*\]/.test(text)) return true;
  // Also detect ChordPro section directives so {start_of_verse} / {end_of_verse}
  // enter the alreadyInline branch instead of being treated as plain lyrics
  if (/\{(?:start_of|s|end_of|e)_\w+/i.test(text)) return true;
  return false;
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
  let currentSection: string | null = null;
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
        output.push(`{end_of_${sectionDirective(currentSection!)}}`);
        output.push("");
      }

      const sectionName = sectionMatch[1];
      const sectionNum = sectionMatch[2] || "";
      currentSection = sectionName.toLowerCase();

      output.push(`{start_of_${sectionDirective(sectionName)}: ${
        sectionName.charAt(0).toUpperCase() +
        sectionName.slice(1).toLowerCase() +
        (sectionNum ? ` ${sectionNum}` : "")
      }}`);
      sectionOpen = true;
      i++;
      continue;
    }

    // Check for section header with content on the same line
    // e.g. "🎸INTRO: A  E  D  F#m" or "Instrumental: Am  C  G"
    const sectionContentMatch = trimmed
      .replace(/^[^\w\s]+/, "")
      .trim()
      .match(
        /^(verse|chorus|bridge|pre[- ]?chorus|intro|outro|interlude|tag|coda|instrumental)(?:\s*(\d+))?\s*:\s*(.+)$/i
      );
    if (sectionContentMatch) {
      if (sectionOpen) {
        output.push(`{end_of_${sectionDirective(currentSection!)}}`);
        output.push("");
      }

      const sectionName = sectionContentMatch[1];
      const sectionNum = sectionContentMatch[2] || "";
      currentSection = sectionName.toLowerCase();

      output.push(`{start_of_${sectionDirective(sectionName)}: ${
        sectionName.charAt(0).toUpperCase() +
        sectionName.slice(1).toLowerCase() +
        (sectionNum ? ` ${sectionNum}` : "")
      }}`);

      const content = sectionContentMatch[3].trim();
      if (alreadyInline || hasInlineChords(content)) {
        output.push(content);
      } else if (isChordLine(content)) {
        const chords = content.split(/\s+/);
        output.push(chords.map((c, i) => i < chords.length - 1 ? `[${c}][ - ]` : `[${c}]`).join(" "));
      } else {
        output.push(content);
      }
      sectionOpen = true;
      i++;
      continue;
    }

    // Empty line — could be section boundary
    if (!trimmed) {
      // If no explicit section headers are used, close/open sections on blank lines
      if (sectionOpen) {
        output.push(`{end_of_${sectionDirective(currentSection!)}}`);
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
      // ChordPro section directive
      const sectionStart = trimmed.match(/^\{(start_of|s)_(\w+)(?::\s*(.+))?\}$/i);
      const sectionEnd = trimmed.match(/^\{(end_of|e)_(\w+)\}$/i);

      if (sectionStart) {
        if (sectionOpen) {
          output.push(`{end_of_${sectionDirective(currentSection!)}}`);
          output.push("");
        }
        currentSection = sectionStart[2].toLowerCase();
        output.push(trimmed);
        sectionOpen = true;
        i++;
        continue;
      }

      if (sectionEnd) {
        output.push(trimmed);
        sectionOpen = false;
        currentSection = null;
        i++;
        continue;
      }

      // "🎸INTRO: A  E  D  F#m" — section header with chords on the same line
      const headerMatch = trimmed
        .replace(/^[^\w\s]+/, "")
        .trim()
        .match(
          /^(verse|chorus|bridge|pre[- ]?chorus|intro|outro|interlude|tag|coda|instrumental)(?:\s*(\d+))?\s*:\s*(.+)$/i
        );
      if (headerMatch) {
        if (sectionOpen) {
          output.push(`{end_of_${sectionDirective(currentSection!)}}`);
          output.push("");
        }
        const sName = headerMatch[1].toLowerCase();
        currentSection = sName;
        output.push(`{start_of_${sectionDirective(sName)}: ${
          sName.charAt(0).toUpperCase() + sName.slice(1).toLowerCase()
        }}`);
        const content = headerMatch[3].trim();
        if (isChordLine(content)) {
          const chords = content.split(/\s+/);
          output.push(chords.map((c, i) => i < chords.length - 1 ? `[${c}][ - ]` : `[${c}]`).join(" "));
        } else {
          output.push(content);
        }
        sectionOpen = true;
        i++;
        continue;
      }

      // Chord-above-lyrics line even in mixed mode
      if (isChordLine(trimmed)) {
        if (!sectionOpen) {
          output.push("{start_of_verse}");
          sectionOpen = true;
          currentSection = "verse";
        }
        const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed && !isChordLine(nextTrimmed) && !nextTrimmed.startsWith("{")) {
          output.push(mergeChordAndLyricLine(line, nextLine));
          i += 2;
          continue;
        }
        const chords = trimmed.split(/\s+/);
        output.push(chords.map((c) => `[${c}]`).join(" "));
        i++;
        continue;
      }

      // Regular line — auto-open section if needed, then pass through
      if (!sectionOpen && trimmed) {
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
    output.push(`{end_of_${sectionDirective(currentSection!)}}`);
  }

  return {
    title,
    chordpro: output.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    detectedKey,
  };
}
