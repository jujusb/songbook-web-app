import { txtToChordPro } from "./txt-import";

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
 * Extract column text from an HTML table.
 * Returns an array of text strings, one per column.
 */
function extractTableColumns(tableHtml: string): string[] {
  const columns: string[] = [];

  // Match each <tr>...</tr> row
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];

    // Match each <td>...</td> or <th>...</th> cell
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowContent)) !== null) {
      cells.push(htmlToText(cellMatch[1]));
    }

    // Add each cell to its column
    for (let ci = 0; ci < cells.length; ci++) {
      if (!columns[ci]) columns[ci] = "";
      if (columns[ci]) columns[ci] += "\n";
      columns[ci] += cells[ci];
    }
  }

  return columns.map((c) => c.trim()).filter(Boolean);
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

  // Check for tables (column layout)
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tableMatches: string[] = [];
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html)) !== null) {
    tableMatches.push(tableMatch[0]);
  }

  if (tableMatches.length > 0) {
    // Process each table column independently, then combine
    const parts: string[] = [];
    let globalTitle: string | null = null;
    let globalKey: string | null = null;

    for (const tableHtml of tableMatches) {
      const columns = extractTableColumns(tableHtml);
      for (const colText of columns) {
        const result = txtToChordPro(colText);
        if (result.title && !globalTitle) globalTitle = result.title;
        if (result.detectedKey && !globalKey) globalKey = result.detectedKey;
        if (result.chordpro) parts.push(result.chordpro);
      }
    }

    const chordpro = parts.join("\n\n").trim();
    return { title: globalTitle, chordpro, detectedKey: globalKey };
  }

  // No table — extract plain text as before
  const text = htmlToText(html);
  return txtToChordPro(text);
}
