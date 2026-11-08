/**
 * Server-side rendering of a recurrent note for a given date.
 * Used by setlists to show a note's text for the date chosen in the setlist.
 */
import { getNote, getNoteManualPeriod } from "@/lib/content/notes";
import { extractApiSectionText, interpolateApiUrl, noteManualSectionKey, type NoteMetadata } from "@/lib/notes";

const FETCH_TIMEOUT_MS = 10_000;

/** Parse YYYY-MM-DD as a local date so formatting does not shift the day. */
function localDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function renderRecurrentNoteForDate(note: NoteMetadata, date: string): Promise<string> {
  const manualPeriod = await getNoteManualPeriod(note.id, date).catch(() => null);
  const legacyOverride = note.periodOverrides?.[date];
  let legacyOverrideUsed = false;

  const chunks: string[] = [];
  const lang = note.language;
  const sections = note.sections || note.content || [];
  for (const [index, section] of sections.entries()) {
    if (section.type === "manual") {
      const periodSection = manualPeriod?.sections[noteManualSectionKey(section, index)];
      if (periodSection) {
        chunks.push(periodSection.mdByLanguage?.[lang] ?? periodSection.md ?? "");
      } else if (legacyOverride && !manualPeriod) {
        if (!legacyOverrideUsed) {
          chunks.push(legacyOverride);
          legacyOverrideUsed = true;
        }
      } else {
        chunks.push(section.mdByLanguage?.[lang] ?? section.md ?? "");
      }
      continue;
    }
    if (!section.api_url) continue;
    try {
      const url = interpolateApiUrl(section.api_url.trim(), { lang, date: localDate(date) });
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Invalid protocol");
      const res = await fetch(url, {
        headers: {
          Accept: "application/json, text/plain, */*",
          ...(section.authorization ? { Authorization: section.authorization } : {}),
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        // keep plain text
      }
      chunks.push(extractApiSectionText(section, data, lang));
    } catch (err) {
      chunks.push(`[${section.name || "api"}] ${err instanceof Error ? err.message : "error"}`);
    }
  }
  return chunks.filter(Boolean).join("\n\n");
}

/** Load a note by id and render it for the date; returns a short message when unavailable. */
export async function renderNoteRefText(noteId: string, date: string): Promise<string> {
  const note = await getNote(noteId).catch(() => null);
  if (!note) return "";
  return renderRecurrentNoteForDate(note, date);
}
