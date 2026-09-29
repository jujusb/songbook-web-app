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

  const createRepeatState = () => ({
    capturing: false,
    label: null as string | null,
    lines: [] as string[],
    lastHtml: null as string | null,
    byLabel: new Map<string, string>(),
  });

  const repeats: Record<RepeatType, {
    capturing: boolean;
    label: string | null;
    lines: string[];
    lastHtml: string | null;
    byLabel: Map<string, string>;
  }> = {
    verse: createRepeatState(),
    chorus: createRepeatState(),
    instrumental: createRepeatState(),
  };

  const emit = (html: string) => {
    out.push(html);
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
        new RegExp(`^\\{(${RE_REPEAT_TYPES})\\s*:\\s*(.+?)\\}$`, "i")
      );
      const bareRepeat = REPEAT_TYPES.find((t) => isRepeatBare(t, raw));
      const startType = isStartOfType(raw);
      const isEndOfSection = new RegExp(
        `^\\{(?:end_of_|e)(${SECTION_TYPES_RE})\\}$`,
        "i"
      ).test(raw);

      if (labeledRepeat) {
        finalizeAll();
        if (repeatChorus) {
          const type = labeledRepeat[1].toLowerCase() as RepeatType;
          const { primary, aliases } = splitSectionAliases(labeledRepeat[2]);
          const html = lookup(type, primary);
          if (html) {
            // A replayed section adopts its alternate name when one is given:
            // "{verse: 1. : 4.}" replays verse 1 but displays as "4.".
            const display = aliases[0] ?? null;
            const relabeled = display
              ? html.replace(
                  /<div class="vce-section-label">([^<]*)<\/div>/,
                  (_m, label) =>
                    label.trim()
                      ? `<div class="vce-section-label">${escapeHtml(display)}</div>`
                      : _m
                )
              : html;
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
          }
        }
        continue;
      }

      if (bareRepeat) {
        finalizeAll();
        if (repeatChorus) {
          const html = repeats[bareRepeat].lastHtml;
          if (html) out.push(`  ${html}`);
        }
        continue;
      }

      if (repeatChorus) {
        if (startType) {
          finalizeAll();
          repeats[startType].capturing = true;
          repeats[startType].label = sectionLabel ?? null;
        } else if (isEndOfSection || sectionLabel) {
          finalizeAll();
        }
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
      for (const cp of chords) {
        if (cp.position > currentPos) {
          chordParts.push(
            `<span class="vce-chord-space">${"&nbsp;".repeat(cp.position - currentPos)}</span>`
          );
        }
        chordParts.push(`<span class="vce-chord">${escapeHtml(cp.chord)}</span>`);
        currentPos = cp.position + cp.chord.length;
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
    emit(
      `  <div class="vce-line"${lineAttr}>` +
        `    <div class="vce-chord-row">${chordParts.join("")}</div>` +
        `    <div class="vce-lyrics-row"><div class="vce-lyrics-text">${lyricsHtml}</div></div>` +
        "  </div>"
    );
    if (isContentLine(line)) contentLine++;
  }

  finalizeAll();

  out.push("</div>");
  return out.join("\n");
}