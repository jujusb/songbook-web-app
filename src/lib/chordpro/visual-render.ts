import {
  parseChordProSource,
  directiveLabel,
  isContentLine,
} from "./visual-parse";

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
  /** Replay the last chorus section where a `{chorus}` directive appears (read-only sheets). */
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

  // `{chorus}` repeat support: capture the HTML emitted for each chorus
  // section so a `{chorus}` directive can replay the last one. Content-line
  // indexing is unaffected — a repeat is presentational only.
  let lastChorusHtml: string | null = null;
  let capturingChorus = false;
  let chorusLines: string[] = [];

  const emit = (html: string) => {
    out.push(html);
    if (capturingChorus) chorusLines.push(html);
  };

  const finalizeChorus = () => {
    if (capturingChorus) {
      capturingChorus = false;
      lastChorusHtml = chorusLines.join("\n");
      chorusLines = [];
    }
  };

  for (const line of lines) {
    if (line.type === "directive") {
      const raw = line.raw.trim();
      const sectionLabel = directiveLabel(line.raw);
      const isChorusRepeat = /^\{chorus\}$/i.test(raw);
      const isStartOfChorus = /^\{(?:start_of_|s)chorus(?:\s*:\s*(?:.+?))?\}$/i.test(raw);
      const isEndOfSection = /^\{(?:end_of_|e)(verse|chorus|bridge)\}$/i.test(raw);

      if (isChorusRepeat) {
        finalizeChorus();
        if (repeatChorus && lastChorusHtml) {
          out.push(`  ${lastChorusHtml}`);
        }
        continue;
      }

      if (repeatChorus) {
        if (isStartOfChorus) {
          finalizeChorus();
          capturingChorus = true;
        } else if (isEndOfSection || sectionLabel) {
          finalizeChorus();
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

  finalizeChorus();

  out.push("</div>");
  return out.join("\n");
}