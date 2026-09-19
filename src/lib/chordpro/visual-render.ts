import {
  parseChordProSource,
  directiveLabel,
} from "./visual-parse";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render ChordPro source to HTML using the same monospace, character-aligned
 * layout the visual editor (VisualChordEditor) uses: chords float on their
 * own row above the lyrics, so a chord never pushes words apart.
 */
export function renderVisualChordSheet(source: string): string {
  const lines = parseChordProSource(source);
  const out: string[] = ['<div class="vce-lines">'];

  for (const line of lines) {
    if (line.type === "directive") {
      const label = directiveLabel(line.raw);
      if (label) {
        out.push(`  <div class="vce-section-label">${escapeHtml(label)}</div>`);
      }
      continue;
    }

    if (!line.lyrics && line.chords.length === 0) {
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
    out.push(
      '  <div class="vce-line">' +
        `    <div class="vce-chord-row">${chordParts.join("")}</div>` +
        `    <div class="vce-lyrics-row"><div class="vce-lyrics-text">${escapeHtml(text)}</div></div>` +
        "  </div>"
    );
  }

  out.push("</div>");
  return out.join("\n");
}