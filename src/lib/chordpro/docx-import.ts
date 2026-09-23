import { txtToChordPro } from "./txt-import";
import { parseSectionHeader } from "./chord-utils";
import type { Buffer } from "node:buffer";

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
 * Convert a list of table cells (one per stanza) into song text. Cells are
 * joined with a blank line so the general importer splits them into separate
 * sections. A cell holding only a bare section header ("(Estribillo final)")
 * is merged with the following stanza cell.
 */
function cellBlocksToText(cells: string[]): string {
  const out: string[] = [];
  const pendingHeaders: string[] = [];

  for (const cell of cells) {
    const text = cell.trim();
    if (!text) continue;

    const header = parseSectionHeader(text);
    if (!text.includes("\n") && header && !header.content) {
      pendingHeaders.push(text);
      continue;
    }

    if (pendingHeaders.length > 0) {
      out.push(pendingHeaders.join("\n") + "\n" + text);
      pendingHeaders.length = 0;
    } else {
      out.push(text);
    }
  }

  if (pendingHeaders.length > 0) out.push(pendingHeaders.join("\n"));

  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Turn a table into song text column by column: the first column is
 * transcribed in full (top to bottom, one cell per stanza), then the second
 * column, and so on. This keeps each column's content together instead of
 * interleaving the columns row by row.
 */
function tableColumnsToText(rows: string[][]): string {
  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const parts: string[] = [];

  for (let c = 0; c < colCount; c++) {
    const cells = rows.map((r) => (r[c] ?? "").trim()).filter((t) => t);
    if (cells.length === 0) continue;
    const text = cellBlocksToText(cells);
    if (text) parts.push(text);
  }

  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Convert mammoth HTML to song text, preserving document order of paragraphs
 * (section headers, citations, …) and tables. Tables are expanded column by
 * column with a blank line between stanza cells.
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
      const text = tableColumnsToText(extractTableRows(match[0]));
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

  // mammoth's bundled browser entry accepts { arrayBuffer }; the Node entry
  // accepts { buffer }. Try the arrayBuffer form first and fall back so the
  // import works regardless of which entry is bundled.
  let result;
  try {
    result = await mammoth.convertToHtml({ arrayBuffer });
  } catch {
    result = await mammoth.convertToHtml({
      buffer: new Uint8Array(arrayBuffer) as unknown as Buffer,
    });
  }
  const html = result.value;

  return txtToChordPro(convertHtmlToText(html));
}