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
 * Section headers ("Verse 1:", "(Estribillo)", "🎸INTRO: A E D …") are converted
 * to ChordPro {start_of_*}/{end_of_*} directives. Section names are recognised
 * in English, Spanish and French. Blank lines split stanzas: every unlabelled
 * stanza becomes a numbered verse, so verses, instrumentals and choruses are
 * separated cleanly when documents put each on its own block.
 */

import {
  isChordLine,
  isCitationLine,
  normalizeChord,
  parseSectionHeader,
  stripTitleNumber,
} from "./chord-utils";

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
      const snapPos = snapToWordStart(col, wordStarts);
      if (snapPos > lastIdx) {
        result += lyricLine.slice(lastIdx, snapPos);
      }
      result += `[${normalizeChord(chord)}]`;
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
      targetPos = snapToWordStart(targetPos, wordStarts);
    }

    if (targetPos > lastIdx) {
      result += lyricLine.slice(lastIdx, targetPos);
    }
    result += `[${normalizeChord(chord)}]`;
    lastIdx = targetPos;
  }

  if (lastIdx < lyricLen) {
    result += lyricLine.slice(lastIdx);
  }
  return result.trimEnd();
}

function snapToWordStart(pos: number, wordStarts: number[]): number {
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
 * or from a "Title:" prefix. Leading numbering ("1. ", "1) ") is stripped.
 */
function extractTitle(lines: string[]): string | null {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // "{title: Something}" / "{t: Something}" / "Title: Something"
    const titleMatch = trimmed.match(
      /^(?:\{(?:t(?:itle)?)\s*[:=]\s*|title\s*[:=]\s*)(.+?)\}?\s*$/i
    );
    if (titleMatch) return stripTitleNumber(titleMatch[1].trim());

    // Skip section headers and chord lines
    if (parseSectionHeader(trimmed)) continue;
    if (isChordLine(trimmed)) continue;

    // First real text line could be the title
    // Only if it doesn't contain chord brackets
    if (!hasInlineChords(trimmed)) {
      return stripTitleNumber(trimmed);
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
  let verseCount = 0;
  let detectedKey: string | null = null;
  let title: string | null = null;

  // Case/space/punctuation-insensitive comparison used to de-duplicate the
  // {title:}/{key:} metadata that was already emitted.
  const comparable = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Check if this is already inline-chord format
  const alreadyInline = hasInlineChords(input);

  // Try to extract a title
  title = extractTitle(lines);

  // Look for key indication
  for (const line of lines) {
    const candidate = line.trim().replace(/^\{|\}$/g, "");
    const keyMatch = candidate.match(/^key\s*[:=]\s*([A-Ga-g][b#]?m?)\s*$/i);
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

  function sectionDirective(name: string): string {
    const lower = name.toLowerCase();
    if (lower === "verse" || lower === "chorus" || lower === "bridge") return lower;
    return lower;
  }

  function openSection(name: string, label: string): void {
    output.push(`{start_of_${sectionDirective(name)}: ${label}}`);
    currentSection = name;
    sectionOpen = true;
  }

  function closeSection(): void {
    if (sectionOpen) {
      output.push(`{end_of_${sectionDirective(currentSection!)}}`);
      output.push("");
      sectionOpen = false;
      currentSection = null;
    }
  }

  // Open a section for an unlabelled stanza. Every stanza is numbered
  // sequentially so blank-line-separated verses, choruses and instrumentals
  // are split into distinct sections.
  function openAutoSection(): void {
    const label = verseCount === 0 ? "Verse" : `Verse ${verseCount + 1}`;
    verseCount++;
    openSection("verse", label);
  }

  // Render header inline content (chords or lyric text on the same line)
  function emitInlineContent(content: string): void {
    if (hasInlineChords(content)) {
      output.push(content);
    } else if (isChordLine(content)) {
      const chords = content.split(/\s+/);
      output.push(
        chords
          .map((c, i) => {
            const chord = normalizeChord(c);
            return i < chords.length - 1 ? `[${chord}][ - ]` : `[${chord}]`;
          })
          .join(" ")
      );
    } else {
      output.push(content);
    }
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip bare "Title:" / "Key:" text lines we already handled
    if (/^title\s*[:=]/i.test(trimmed) || /^key\s*[:=]/i.test(trimmed)) {
      i++;
      continue;
    }

    // Skip the {title:}/{key:} metadata we already emitted (duplicates only).
    // Other instances (e.g. a second song in the same file) are allowed to
    // pass through verbatim below instead of being dropped.
    const dupTitle = trimmed.match(/^\{(?:t(?:itle)?)\s*[:=]\s*(.+?)\}\s*$/i);
    if (dupTitle && title && comparable(dupTitle[1].trim()) === comparable(title)) {
      i++;
      continue;
    }
    const dupKey = trimmed.match(/^\{(?:key)\s*[:=]\s*(.+?)\}\s*$/i);
    if (dupKey && detectedKey && comparable(dupKey[1].trim()) === comparable(detectedKey)) {
      i++;
      continue;
    }
    if (trimmed.match(/^\{(?:t(?:itle)?|key)\s*[:=]\s*.+\}\s*$/i)) {
      closeSection();
      output.push(trimmed);
      i++;
      continue;
    }

    // Section header (with or without inline content)
    const header = parseSectionHeader(trimmed);
    if (header) {
      closeSection();
      openSection(header.directive, header.name);
      if (header.content) {
        emitInlineContent(header.content);
      }
      i++;
      continue;
    }

    // Empty line — section boundary: close the current section so the next
    // stanza starts fresh (newline-split verses/choruses).
    if (!trimmed) {
      if (sectionOpen) {
        closeSection();
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
        closeSection();
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

      // Pass through any other ChordPro directive (e.g. a second {title:},
      // {comment:}, {verse: 2}) untouched instead of absorbing it into a verse
      if (/^\{.+?\}\s*$/.test(trimmed)) {
        output.push(trimmed);
        i++;
        continue;
      }

      // Skip citation lines (turn into comments) before touching sections
      if (isCitationLine(trimmed)) {
        output.push(`{comment: ${trimmed}}`);
        i++;
        continue;
      }

      // Chord-above-lyrics line even in mixed mode
      if (isChordLine(trimmed)) {
        if (!sectionOpen) {
          openAutoSection();
        }
        const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed && !isChordLine(nextTrimmed) && !nextTrimmed.startsWith("{")) {
          output.push(mergeChordAndLyricLine(line, nextLine));
          i += 2;
          continue;
        }
        const chords = trimmed.split(/\s+/);
        output.push(chords.map((c) => `[${normalizeChord(c)}]`).join(" "));
        i++;
        continue;
      }

      // Skip the title line
      if (title && stripTitleNumber(trimmed) === title) {
        i++;
        continue;
      }

      // Regular line — auto-open section if needed, then pass through
      if (!sectionOpen && trimmed) {
        openAutoSection();
      }
      output.push(trimmed);
      i++;
      continue;
    }

    // Citation line — do not open a verse for e.g. "Lc 1,47"
    if (isCitationLine(trimmed)) {
      output.push(`{comment: ${trimmed}}`);
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
        openAutoSection();
      }

      // If next line is also a chord line or empty, this is a chords-only line
      if (!nextTrimmed || isChordLine(nextTrimmed) || parseSectionHeader(nextTrimmed)) {
        // Chords-only line (e.g. instrumental)
        const chords = trimmed.split(/\s+/);
        output.push(chords.map((c) => `[${normalizeChord(c)}]`).join(" "));
        i++;
      } else {
        // Merge chord line with lyric line below
        const merged = mergeChordAndLyricLine(chordLine, nextLine);
        output.push(merged);
        i += 2;
      }
      continue;
    }

    // Skip the title line
    if (title && stripTitleNumber(trimmed) === title) {
      i++;
      continue;
    }

    // Plain lyric line (no chords above)
    if (!sectionOpen) {
      openAutoSection();
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