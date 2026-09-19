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
  } = options;
  const lines = parseChordProSource(source);
  const out: string[] = ['<div class="vce-lines">'];
  let contentLine = 0;

  for (const line of lines) {
    if (line.type === "directive") {
      const label = directiveLabel(line.raw);
      if (label) {
        out.push(`  <div class="vce-section-label">${escapeHtml(label)}</div>`);
      } else if (renderDirectives) {
        const metadata = renderMetadataDirective(line.raw);
        if (metadata) out.push(`  ${metadata}`);
      }
      continue;
    }

    if (!isContentLine(line) && line.chords.length === 0) {
      out.push("  <div class=\"vce-empty-line\"></div>");
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
    out.push(
      `  <div class="vce-line"${lineAttr}>` +
        `    <div class="vce-chord-row">${chordParts.join("")}</div>` +
        `    <div class="vce-lyrics-row"><div class="vce-lyrics-text">${lyricsHtml}</div></div>` +
        "  </div>"
    );
    if (isContentLine(line)) contentLine++;
  }

  out.push("</div>");
  return out.join("\n");
}