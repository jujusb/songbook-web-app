/**
 * Format-agnostic document import. The Word/PDF parsers are heavy, so each
 * converter is loaded on demand — the browser bundle only pulls in the one the
 * selected files actually need.
 */

export type ImportFormat = "docx" | "pdf" | "txt";

export const IMPORT_FORMATS: ImportFormat[] = ["docx", "pdf", "txt"];

export type ConvertedSong = {
  title: string | null;
  chordpro: string;
  detectedKey: string | null;
};

/**
 * Extensions accepted per format; also used for the file picker's `accept`.
 * `.cho`/`.chordpro` are deliberately absent: running ChordPro source through
 * the plain-text converter would mangle its directives.
 */
const FORMAT_EXTENSIONS: Record<ImportFormat, string[]> = {
  docx: [".docx"],
  pdf: [".pdf"],
  txt: [".txt", ".text"],
};

/** Guess the format from a file name, or null when the extension is unknown. */
export function formatForFileName(fileName: string): ImportFormat | null {
  const lower = fileName.toLowerCase();
  for (const format of IMPORT_FORMATS) {
    if (FORMAT_EXTENSIONS[format].some((ext) => lower.endsWith(ext))) {
      return format;
    }
  }
  return null;
}

export function acceptAttribute(): string {
  return IMPORT_FORMATS.flatMap((f) => FORMAT_EXTENSIONS[f]).join(",");
}

export async function convertFile(
  file: File,
  format: ImportFormat
): Promise<ConvertedSong> {
  if (format === "docx") {
    const { docxToChordPro } = await import("./docx-import");
    return docxToChordPro(file);
  }
  if (format === "pdf") {
    const { pdfToChordPro } = await import("./pdf-import");
    return pdfToChordPro(file);
  }
  const { txtToChordPro } = await import("./txt-import");
  return txtToChordPro(await file.text());
}
