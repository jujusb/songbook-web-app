import { txtToChordPro } from "./txt-import";
import { parseSectionHeader } from "./chord-utils";

function htmlToText(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/^\s*[\r\n]+/gm, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Extract the cell text of every `<tr>` in a table HTML string.
 * Returns an array of rows; each row is an array of cell texts with
 * paragraph/line breaks inside a cell preserved as "\n".
 */
function extractTableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(htmlToText(cellMatch[1]));
    }
    rows.push(cells);
  }

  return rows;
}

/**
 * Turn a table into song text. Each table row corresponds to one stanza —
 * its cell usually contains many chord/lyric lines stacked as paragraphs.
 * Cells inside a row are stacked (chords column above lyrics column), and
 * each new table row is separated by a blank line so the general importer
 * splits the stanzas into separate sections. A row holding only a section
 * header ("(Estribillo final)") is merged with the stanza row that follows.
 */
function tableRowsToText(rows: string[][]): string {
  const blankBlocks: string[] = [];
  const pendingHeader: string[] = [];

  for (const cells of rows) {
    const lines: string[] = [];
    for (const cell of cells) {
      if (cell.trim()) lines.push(cell);
    }
    const text = lines.join("\n").trim();
    if (!text) {
      blankBlocks.push("");
      continue;
    }

    // Bare section header in its own row → attach it to the next stanza
    const header = parseSectionHeader(lines[0]?.trim() ?? "");
    if (lines.length === 1 && header && !header.content) {
      pendingHeader.push(text);
      continue;
    }

    if (pendingHeader.length > 0) {
      blankBlocks.push(pendingHeader.join("\n") + "\n" + text);
      pendingHeader.length = 0;
    } else {
      blankBlocks.push(text);
    }
  }

  if (pendingHeader.length > 0) blankBlocks.push(pendingHeader.join("\n"));

  return blankBlocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Convert mammoth HTML to song text, preserving document order of paragraphs
 * (section headers, citations, …) and tables. Tables are expanded row-wise
 * with a blank line between stanzas.
 */
function convertHtmlToText(html: string): string {
  const blocks: string[] = [];
  const blockRe = /<table[^>]*>[\s\S]*?<\/table>|<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = blockRe.exec(html)) !== null) {
    const between = html.slice(lastIndex, match.index).replace(/<[^>]+>/g, "").trim();
    if (between) blocks.push(between);

    if (match[0].toLowerCase().startsWith("<table")) {
      const text = tableRowsToText(extractTableRows(match[0]));
      if (text) blocks.push(text);
    } else {
      const text = htmlToText(match[0]);
      if (text) blocks.push(text);
    }
    lastIndex = blockRe.lastIndex;
  }

  const rest = html.slice(lastIndex).replace(/<[^>]+>/g, "").trim();
  if (rest) blocks.push(rest);

  return blocks.filter((b) => b.trim()).join("\n\n");
}

export async function docxToChordPro(file: File): Promise<{
  title: string | null;
  chordpro: string;
  detectedKey: string | null;
}> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  return txtToChordPro(convertHtmlToText(html));
}