import {
  parseChordProSource,
  directiveLabel,
  isContentLine,
} from "./visual-parse";
import { SECTION_TYPES, splitSectionAliases } from "./chord-utils";

const SECTION_TYPES_RE = SECTION_TYPES.join("|");

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface VisualRenderOptions {
  /** Render non-section directives (title, subtitle, key, comments) as metadata blocks (read-only sheets). */
  renderDirectives?: boolean;
  /** Emit `data-content-line` on each `.vce-line` so it can be picked by index. */
  dataContentLine?: boolean;
  /** Wrap the given lyric substring in a `<mark class="vce-ref-select">`. */
  highlightRange?: { line: number; start: number; end: number };
  /** Replay repeated sections where `{chorus}` / `{verse}` / `{instrumental}` or their `: label` variants appear (read-only sheets). */
  repeatChorus?: boolean;
  /** Render chords inline with lyrics (in brackets) instead of on a separate row.
   * Useful for responsive layouts (mobile, PDF) where separate rows wrap independently. */
  inlineChords?: boolean;
  hideInstrumentals?: boolean;
  /** When false, chord rows are not rendered (chords hidden). */
  showChords?: boolean;
  /**
   * Split each line at its chords into `.vce-seg` blocks (chord over its lyric
   * part). Segments wrap as whole units, so on narrow screens a line reads
   * chord/lyric/chord/lyric instead of all chords stacked above all lyrics.
   */
  wrapSegments?: boolean;
}

interface LineSegment {
  chord: string;
  start: number;
  end: number;
}

/** Split a lyric line at each chord position (positions are lyric char indexes). */
function splitSegments(lyrics: string, chords: { position: number; chord: string }[]): LineSegment[] {
  const sorted = [...chords].sort((a, b) => a.position - b.position);
  const starts: { start: number; chord: string }[] = [];
  if (sorted.length === 0 || sorted[0].position > 0) starts.push({ start: 0, chord: "" });
  for (const cp of sorted) {
    let start = Math.min(Math.max(cp.position, 0), lyrics.length);
    // A chord on a space belongs to the word after it: the space stays at the
    // end of the previous segment, so no segment starts with a visible gap.
    while (start < lyrics.length && /\s/.test(lyrics[start])) start++;
    // Never split a word: when the chord sits inside a word, the segment
    // starts at the beginning of that word (the chord moves back with it).
    while (start > 0 && start < lyrics.length && !/\s/.test(lyrics[start - 1]) && !/\s/.test(lyrics[start])) {
      start--;
    }
    starts.push({ start, chord: cp.chord });
  }
  return starts.map((seg, i) => ({
    chord: seg.chord,
    start: seg.start,
    end: i + 1 < starts.length ? starts[i + 1].start : lyrics.length,
  }));
}

function renderMetadataDirective(raw: string): string | null {
  const m = raw.trim().match(/^\{(.+?)(?:\s*:\s*(.*?))?\}$/);
  if (!m) return null;
  const name = m[1].trim().toLowerCase();
  const value = (m[2] || "").trim();
  if (!value) return null;
  switch (name) {
    case "title":
      return `<div class="vce-metadata vce-title">${escapeHtml(value)}</div>`;
    case "subtitle":
      return `<div class="vce-metadata vce-subtitle">${escapeHtml(value)}</div>`;
    case "key":
      return `<div class="vce-metadata vce-key">${escapeHtml(value)}</div>`;
    case "capo":
      return `<div class="vce-metadata vce-capo">Capo ${escapeHtml(value)}</div>`;
    case "comment":
    case "c":
      return `<div class="vce-comment">${escapeHtml(value)}</div>`;
    default:
      return null;
  }
}

/**
 * Render ChordPro source to HTML using the same monospace, character-aligned
 * layout the visual editor (VisualChordEditor) uses: chords float on their
 * own row above the lyrics, so a chord never pushes words apart.
 */
export function renderVisualChordSheet(
  source: string,
  options: VisualRenderOptions = {}
): string {
  const {
    renderDirectives = false,
    dataContentLine = false,
    highlightRange,
    repeatChorus = false,
    inlineChords = false,
    hideInstrumentals = false,
    showChords = true,
    wrapSegments = false,
  } = options;
  const lines = parseChordProSource(source);
  const out: string[] = ['<div class="vce-lines">'];
  let contentLine = 0;

  // Repeat support mirroring ChordPro's `{chorus}` shorthand: capture the HTML
  // emitted for each verse, chorus, and instrumental section so a repeat
  // directive can replay it. `{chorus}`, `{verse}`, `{instrumental}` (bare)
  // replay the last section of that type; `{verse: x}`, `{chorus: x}`,
  // `{instrumental: x}` replay the section whose label matches x. Content-line
  // indexing is unaffected — a repeat is presentational only.
  type RepeatType = "verse" | "chorus" | "instrumental";
  const REPEAT_TYPES: RepeatType[] = ["verse", "chorus", "instrumental"];
  const RE_REPEAT_TYPES = REPEAT_TYPES.join("|");

  // Pre-scan: detect which section types have bare repeat directives (e.g., {verse}, {chorus})
  // This helps avoid duplicate rendering when repeatChorus is true
  const repeatedSectionTypes = new Set<RepeatType>();
  if (repeatChorus) {
    const bareRepeatRegex = new RegExp(`^\\{(${RE_REPEAT_TYPES})\\}$`, "i");
    for (const line of lines) {
      if (line.type === "directive") {
        const match = line.raw.trim().match(bareRepeatRegex);
        if (match) {
          repeatedSectionTypes.add(match[1].toLowerCase() as RepeatType);
        }
      }
    }
  }

  const createRepeatState = () => ({
    capturing: false,
    label: null as string | null,
    lines: [] as string[],
    lastHtml: null as string | null,
    byLabel: new Map<string, string>(),
    seenLabels: new Set<string>(),
  });

  let skipSection = false;
  const repeats: Record<RepeatType, {
    capturing: boolean;
    label: string | null;
    lines: string[];
    lastHtml: string | null;
    byLabel: Map<string, string>;
    seenLabels: Set<string>;
  }> = {
    verse: { ...createRepeatState(), seenLabels: new Set() },
    chorus: { ...createRepeatState(), seenLabels: new Set() },
    instrumental: { ...createRepeatState(), seenLabels: new Set() },
  };

  const lastSectionLabel: Record<RepeatType, string | null> = {
    verse: null,
    chorus: null,
    instrumental: null,
  };

  // Track which section type is currently being captured (so we only suppress output for that type)
  let currentCapturingType: RepeatType | null = null;

  const emit = (html: string) => {
    // Don't output to final if we're currently capturing a section type
    // that has a corresponding bare repeat directive AND we've already
    // finalized this exact label before (to avoid duplicates).
    if (
      currentCapturingType !== null &&
      repeatedSectionTypes.has(currentCapturingType) &&
      repeats[currentCapturingType].seenLabels.has(
        (repeats[currentCapturingType].label ?? "").toLowerCase().trim()
      )
    ) {
      // We're capturing a section that will be repeated AND we've already
      // finalized this exact label before, don't output inline
    } else {
      out.push(html);
    }
    for (const type of REPEAT_TYPES) {
      if (repeats[type].capturing) repeats[type].lines.push(html);
    }
  };

  const finalize = (type: RepeatType) => {
    const st = repeats[type];
    if (st.capturing) {
      st.lastHtml = st.lines.join("\n");
      if (st.label) {
        const normalized = st.label.toLowerCase().trim();
        st.byLabel.set(normalized, st.lastHtml);
        st.seenLabels.add(normalized);
        if (!normalized.startsWith(`${type} `)) {
          st.byLabel.set(`${type} ${normalized}`, st.lastHtml);
        }
        const numMatch = normalized.match(/(\d+)$/);
        if (numMatch) st.byLabel.set(numMatch[1], st.lastHtml);
      }
      st.lines = [];
    }
    st.capturing = false;
    st.label = null;
    if (currentCapturingType === type) currentCapturingType = null;
  };

  const finalizeAll = () => REPEAT_TYPES.forEach(finalize);

  const lookup = (type: RepeatType, req: string): string | null =>
    repeats[type].byLabel.get(req.trim().toLowerCase()) ?? null;

  const isRepeatBare = (type: RepeatType, raw: string) =>
    new RegExp(`^\\{${type}\\}$`, "i").test(raw);

  const isStartOfType = (raw: string): RepeatType | null => {
    const regex = new RegExp(
      `^\\{(?:start_of_|s)(${RE_REPEAT_TYPES})(?:\\s*:\\s*(?:.+?))?\\}$`,
      "i"
    );
    const m = raw.match(regex);
    return m ? (m[1].toLowerCase() as RepeatType) : null;
  };

  for (const line of lines) {
    if (line.type === "directive") {
      const raw = line.raw.trim();
      const sectionLabel = directiveLabel(line.raw);
const labeledRepeat = raw.match(
        new RegExp(`^\\{(${RE_REPEAT_TYPES})(?!\\w)\\s*:\\s*(.+?)\\}$`, "i")
      );
      const bareRepeat = REPEAT_TYPES.find((t) => isRepeatBare(t, raw));
      const startType = isStartOfType(raw);
      const isEndOfSection = new RegExp(
        `^\\{(?:end_of_|e)(${SECTION_TYPES_RE})\\}$`,
        "i"
      ).test(raw);
      const isEndOfInstrumental = /^\{(?:end_of_|e)instrumental\}$/i.test(raw);

      if (labeledRepeat) {
        finalizeAll();
        const type = labeledRepeat[1].toLowerCase() as RepeatType;
        const { primary, aliases } = splitSectionAliases(labeledRepeat[2]);
        const display = aliases[0] ?? null;
        const label = display || primary;

        if (hideInstrumentals && type === 'instrumental') {
          continue;
        }
        if (!repeatChorus) {
          out.push(`  <div class="vce-section-label vce-section-label--repeat">${escapeHtml(label)}</div>`);
          continue;
        }
        if (repeatChorus || type !== 'chorus') {
          if (type === 'instrumental') {
            const html = lookup(type, primary);
            if (html) {
              const relabeled = display
                ? html.replace(
                    /<div class="vce-section-label">([^<]*)<\/div>/,
                    (_m, lbl) =>
                      lbl.trim()
                        ? `<div class="vce-section-label">${escapeHtml(display)}</div>`
                        : _m
                  )
                : html;
              out.push(`  <div class="vce-section-label">${escapeHtml(label)}</div>`);
              out.push(`  ${relabeled}`);
              const st = repeats[type];
              st.lastHtml = relabeled;
              for (const alias of aliases) {
                const norm = alias.toLowerCase().trim();
                if (!norm) continue;
                st.byLabel.set(norm, relabeled);
                st.byLabel.set(`${type} ${norm}`, relabeled);
              }
            } else {
              out.push(`  <div class="vce-section-label">${escapeHtml(label)}</div>`);
            }
            continue;
          }
          const html = lookup(type, primary);
          if (html) {
            // A replayed section adopts its alternate name when one is given:
            // "{verse: 1. : 4.}" replays verse 1 but displays as "4.".
            const relabeled = display
              ? html.replace(
                  /<div class="vce-section-label">([^<]*)<\/div>/,
                  (_m, lbl) =>
                    lbl.trim()
                      ? `<div class="vce-section-label">${escapeHtml(display)}</div>`
                      : _m
                )
              : html;
            out.push(`  <div class="vce-section-label">${escapeHtml(label)}</div>`);
            out.push(`  ${relabeled}`);
            // Register any aliases ("{verse: 1. : 4.}" → "4.") so later
            // repeats or lookups can replay the section by either name.
            const st = repeats[type];
            st.lastHtml = relabeled;
            for (const alias of aliases) {
              const norm = alias.toLowerCase().trim();
              if (!norm) continue;
              st.byLabel.set(norm, relabeled);
              st.byLabel.set(`${type} ${norm}`, relabeled);
            }
            continue;
          }
        }
        // Show only the section label when repeatChorus is false (for chorus)
        out.push(`  <div class="vce-section-label vce-section-label--repeat">${escapeHtml(label)}</div>`);
        continue;
      }

      if (isEndOfInstrumental) {
        skipSection = false;
        finalizeAll();
        continue;
      }

      if (bareRepeat) {
        finalizeAll();
        if (hideInstrumentals && bareRepeat === 'instrumental') {
          continue;
        }
        if (!repeatChorus) {
          const label = lastSectionLabel[bareRepeat] ?? null;
          if (label) {
            out.push(`  <div class="vce-section-label vce-section-label--repeat">${escapeHtml(label)}</div>`);
          }
          continue;
        }
        if (repeatChorus || bareRepeat !== 'chorus') {
          if (bareRepeat === 'instrumental') {
            const html = repeats[bareRepeat].lastHtml;
            if (html) {
              if (repeats[bareRepeat].label) {
                out.push(`  <div class="vce-section-label">${escapeHtml(repeats[bareRepeat].label)}</div>`);
              }
              out.push(`  ${html}`);
            } else if (repeats[bareRepeat].label) {
              out.push(`  <div class="vce-section-label">${escapeHtml(repeats[bareRepeat].label)}</div>`);
            }
            continue;
          }
          const html = repeats[bareRepeat].lastHtml;
          if (html) {
            if (repeats[bareRepeat].label) {
              out.push(`  <div class="vce-section-label">${escapeHtml(repeats[bareRepeat].label)}</div>`);
            }
            out.push(`  ${html}`);
            continue;
          }
        }
        // Show section label for bare repeat when repeatChorus is false
        const st = repeats[bareRepeat];
        if (st && st.label) {
          out.push(`  <div class="vce-section-label vce-section-label--repeat">${escapeHtml(st.label)}</div>`);
        }
        continue;
      }

      if (repeatChorus) {
        if (startType) {
          finalizeAll();
          if (hideInstrumentals && startType === 'instrumental') {
            skipSection = true;
            continue;
          }
          repeats[startType].capturing = true;
          repeats[startType].label = sectionLabel ?? null;
          currentCapturingType = startType;
        } else if (isEndOfSection || sectionLabel) {
          finalizeAll();
        }
      } else {
        if (startType) {
          finalizeAll();
          lastSectionLabel[startType] = sectionLabel ?? null;
          if (hideInstrumentals && startType === 'instrumental') {
            skipSection = true;
            continue;
          }
          if (startType === 'instrumental' || startType === 'chorus') {
            if (sectionLabel) {
              emit(`  <div class="vce-section-label vce-section-label--repeat">${escapeHtml(sectionLabel)}</div>`);
            }
            skipSection = true;
            continue;
          }
        } else if (isEndOfSection) {
          finalizeAll();
          skipSection = false;
        } else if (sectionLabel) {
          finalizeAll();
        }
      }

      if (skipSection) {
        continue;
      }

      if (sectionLabel) {
        emit(`  <div class="vce-section-label">${escapeHtml(sectionLabel)}</div>`);
      } else if (renderDirectives) {
        const metadata = renderMetadataDirective(line.raw);
        if (metadata) emit(`  ${metadata}`);
      }
      continue;
    }

    if (!isContentLine(line) && line.chords.length === 0) {
      emit('  <div class="vce-empty-line"></div>');
      continue;
    }

    const chords = [...line.chords].sort((a, b) => a.position - b.position);
    const chordParts: string[] = [];

    if (chords.length === 0) {
      chordParts.push('<span class="vce-chord-placeholder">&nbsp;</span>');
    } else {
      let currentPos = 0;
      const lyricsText = line.lyrics || "";
      for (const cp of chords) {
        // A chord on a space is drawn over the next word's first letter.
        let position = Math.max(cp.position, currentPos);
        while (position < lyricsText.length && /\s/.test(lyricsText[position])) position++;
        if (position > currentPos) {
          chordParts.push(
            `<span class="vce-chord-space">${"&nbsp;".repeat(position - currentPos)}</span>`
          );
        }
        chordParts.push(`<span class="vce-chord">${escapeHtml(cp.chord)}</span>`);
        currentPos = position + cp.chord.length;
      }
    }

    const text = line.lyrics || "\u00A0";
    let lyricsHtml = escapeHtml(text);
    if (highlightRange && highlightRange.line === contentLine) {
      const s = Math.max(0, Math.min(highlightRange.start, text.length));
      const e = Math.max(s, Math.min(highlightRange.end, text.length));
      if (e > s) {
        lyricsHtml =
          escapeHtml(text.slice(0, s)) +
          `<mark class="vce-ref-select">${escapeHtml(text.slice(s, e))}</mark>` +
          escapeHtml(text.slice(e));
      }
    }
    const lineAttr = dataContentLine ? ` data-content-line="${contentLine}"` : "";
    if (wrapSegments) {
      const text = line.lyrics || "\u00A0";
      const segments = splitSegments(text, line.chords);
      const segHtml = segments
        .map((seg) => {
          const piece = text.slice(seg.start, seg.end);
          let body = escapeHtml(piece);
          if (highlightRange && highlightRange.line === contentLine) {
            const from = Math.max(highlightRange.start, seg.start);
            const to = Math.min(highlightRange.end, seg.end);
            if (to > from) {
              body =
                escapeHtml(text.slice(seg.start, from)) +
                `<mark class="vce-ref-select">${escapeHtml(text.slice(from, to))}</mark>` +
                escapeHtml(text.slice(to, seg.end));
            }
          }
          // Chord first in the source so the reading order is chord, lyric,
          // chord, lyric. The chord is positioned above its lyric text, so it
          // takes no width and the text flows and breaks at word boundaries.
          const chordHtml =
            showChords && seg.chord !== ""
              ? `<span class="vce-chord">${escapeHtml(seg.chord)}</span>`
              : "";
          return `<span class="vce-seg">${chordHtml}<span class="vce-lyrics-text">${body || "&nbsp;"}</span></span>`;
        })
        .join("");
      emit(`  <div class="vce-line wrap"${lineAttr}>${segHtml}</div>`);
      if (isContentLine(line)) contentLine++;
      continue;
    }
    emit(
      `  <div class="vce-line"${lineAttr}>` +
        `${showChords ? `    <div class="vce-chord-row">${chordParts.join("")}</div>` : ""}` +
        `    <div class="vce-lyrics-row"><div class="vce-lyrics-text">${lyricsHtml}</div></div>` +
        "  </div>"
    );
    if (isContentLine(line)) contentLine++;
  }

  finalizeAll();

  out.push("</div>");
  return out.join("\n");
}