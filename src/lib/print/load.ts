import {
  getSong,
  getSongTranslations,
  getSongTranslation,
  getSongTitle,
  extractBodyCapo,
} from '@/lib/content';
import { renderToHtml, renderReferencesHtml } from '@/lib/chordpro';
import { convertChord, type ChordNotation } from '@/lib/chordpro/notation';
import type { PrintSong } from '@/lib/print/types';
import type { ResolvedScopeSong } from '@/lib/export/song-scope';
import { getReferenceText, getHighlight } from '@/lib/content/references';

interface SectionInfo {
  type: string;
  label: string;
  startLine: number;
  endLine: number;
}

interface ReferenceLocation {
  line?: number;
  verse?: string;
  chorus?: string;
  highlight?: string;
  highlights?: Record<string, string>;
  locations?: Array<{ line?: number; verse?: string; chorus?: string; highlight?: string; highlights?: Record<string, string> }>;
}

interface Reference {
  type: string;
  label: string;
  target: string;
  text?: string;
  texts?: Record<string, string>;
  highlight?: string;
  highlights?: Record<string, string>;
  line?: number;
  verse?: string;
  chorus?: string;
  locations?: ReferenceLocation[];
}

interface Footnote {
  index: number;
  reference: Reference;
  lineIndex: number;
  highlight?: string;
}

interface ReferenceLocation {
  line?: number;
  verse?: string;
  chorus?: string;
  highlight?: string;
  highlights?: Record<string, string>;
  locations?: Array<{ line?: number; verse?: string; chorus?: string; highlight?: string; highlights?: Record<string, string> }>;
}

interface Reference {
  type: string;
  label: string;
  target: string;
  text?: string;
  texts?: Record<string, string>;
  highlight?: string;
  highlights?: Record<string, string>;
  line?: number;
  verse?: string;
  chorus?: string;
  locations?: ReferenceLocation[];
}

interface Footnote {
  index: number;
  reference: Reference;
  lineIndex: number;
  highlight?: string;
}

function resolveLocation(loc: ReferenceLocation, sectionMap: SectionInfo[]): number | null {
  if (loc.line !== undefined) return loc.line;
  if (loc.verse) {
    const sec = sectionMap.find((s) => s.type === 'verse' && s.label === loc.verse);
    return sec?.startLine ?? null;
  }
  if (loc.chorus) {
    const sec = sectionMap.find((s) => s.type === 'chorus' && s.label === loc.chorus);
    return sec?.startLine ?? null;
  }
  return null;
}

function buildFootnotes(
  references: Reference[],
  sectionMap: SectionInfo[],
  lang: string
): Footnote[] {
  const footnotes: Footnote[] = [];
  let idx = 1;

  for (const ref of references) {
    const locs: ReferenceLocation[] = [];

    if (ref.locations && ref.locations.length > 0) {
      locs.push(...ref.locations);
    } else if (ref.line !== undefined || ref.verse || ref.chorus) {
      locs.push({ line: ref.line, verse: ref.verse, chorus: ref.chorus });
    }

    if (locs.length === 0) continue;

    const seen = new Set<number>();
    for (const loc of locs) {
      const lineIndex = resolveLocation(loc, sectionMap);
      if (lineIndex !== null && !seen.has(lineIndex)) {
        seen.add(lineIndex);
        footnotes.push({
          index: idx++,
          reference: ref,
          lineIndex,
          highlight: getHighlight(loc, lang) || getHighlight(ref, lang),
        });
      }
    }
  }

  return footnotes;
}

function injectMarkersIntoSource(
  source: string,
  footnotesByLine: Map<number, Footnote[]>
): string {
  if (footnotesByLine.size === 0) return source;

  const lines = source.split("\n");
  const result: string[] = [];
  let contentLineIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Directives ({...}) are not content lines
    if (trimmed.startsWith("{")) {
      result.push(line);
      continue;
    }

    // Empty lines
    if (!trimmed) {
      result.push(line);
      continue;
    }

    // This is a content line — check if it has footnotes
    const fns = footnotesByLine.get(contentLineIndex);
    if (fns && fns.length > 0) {
      const markerText = fns
        .map(
          (fn) =>
            `<a href="#footnote-${fn.index}" class="footnote-ref">[${fn.index}]</a>`
        )
        .join(" ");
      result.push(line + " " + markerText);
    } else {
      result.push(line);
    }

    contentLineIndex++;
  }

  return result.join("\n");
}

function buildSectionMap(source: string): SectionInfo[] {
  const lines = source.split("\n");
  const sections: SectionInfo[] = [];
  let currentSection: SectionInfo | null = null;
  let contentLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const startMatch = line.match(/^\{(?:start_of_|s)(verse|chorus|instrumental|bridge|prechorus|intro|outro|interlude|coda|tag)(?:\s*:\s*(.+?))?\}/i);
    const endMatch = line.match(/^\{(?:end_of_|e)(verse|chorus|instrumental|bridge|prechorus|intro|outro|interlude|coda|tag)\}/i);

    if (startMatch) {
      const type = startMatch[1].toLowerCase();
      const label = startMatch[2]?.trim() || type.charAt(0).toUpperCase() + type.slice(1);
      if (currentSection) {
        currentSection.endLine = contentLine - 1;
        sections.push(currentSection);
      }
      currentSection = { type, label, startLine: contentLine, endLine: contentLine };
    } else if (endMatch && currentSection) {
      currentSection.endLine = contentLine;
      sections.push(currentSection);
      currentSection = null;
    } else if (!line.startsWith("{") && line !== "") {
      contentLine++;
    }
  }
  if (currentSection) {
    currentSection.endLine = contentLine - 1;
    sections.push(currentSection);
  }
  return sections;
}

function renderFootnoteListHtml(footnotes: Footnote[], lang: string): string {
  if (footnotes.length === 0) return '';
  const items = footnotes.map((fn) => {
    const r = fn.reference;
    let link: string;
    if (r.type === 'song') {
      link = `<a href="/songs/${escapeHtml(r.target)}">${escapeHtml(r.label)}</a>`;
    } else if (r.type === 'link') {
      link = `<a href="${escapeHtml(r.target)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.label)}</a>`;
    } else {
      link = escapeHtml(r.label);
    }
    const text = getReferenceText(r, lang);
    const hl = fn.highlight;
    let textHtml = '';
    if (text) {
      textHtml = `<div class="ref-text">${renderHighlightedHtml(text, hl)}</div>`;
    }
    return `<li id="footnote-${fn.index}"><span class="footnote-marker">[${fn.index}]</span> ${link}${textHtml}</li>`;
  }).join('\n');
  return `<div class="song-references"><div class="ref-header">References</div><ol>${items}</ol></div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function renderHighlightedHtml(text: string, highlight?: string): string {
  if (!highlight) return escapeHtml(text);
  const index = text.indexOf(highlight);
  if (index === -1) return escapeHtml(text);
  const before = escapeHtml(text.slice(0, index));
  const marked = escapeHtml(highlight);
  const after = escapeHtml(text.slice(index + highlight.length));
  return `${before}<mark>${marked}</mark>${after}`;
}

/**
 * Parse-only plan of the chapters a print run would produce for a scope —
 * used by the PDF conversion page's viewer to show exactly what will be
 * downloaded without rendering any HTML.
 */
export interface ChapterPlan {
  songId: string;
  title: string;
  key?: string;
  lang: string;
}

export async function planSongbookChapters(
  songs: ResolvedScopeSong[],
  languages: string[],
): Promise<ChapterPlan[]> {
  const plan: ChapterPlan[] = [];
  for (const resolved of songs) {
    const songId = resolved.songId;
    if (resolved.lang != null) {
      const title = await getSongTitle(songId, resolved.lang).catch(
        () => resolved.meta?.title ?? songId,
      );
      plan.push({
        songId,
        title,
        key: resolved.meta?.key,
        lang: resolved.lang,
      });
      continue;
    }
    const translations = await getSongTranslations(songId).catch(() => [] as string[]);
    for (const lang of languages) {
      if (!translations.includes(lang)) continue;
      const title = await getSongTitle(songId, lang).catch(
        () => resolved.meta?.title ?? songId,
      );
      plan.push({
        songId,
        title,
        key: resolved.meta?.key,
        lang,
      });
    }
  }
  return plan;
}

/**
 * Build the list of printable song chapters from a resolved scope.
 *
 * - Setlist items carry an explicit `lang`: that translation is always used.
 * - Other scopes iterate `languages`: for each song every requested language
 *   with an available translation produces one chapter.
 *
 * `showRefs` embeds song references (when present) under each chapter, in the
 * chapter's language.
 */
export async function loadPrintSongs(
  songs: ResolvedScopeSong[],
  languages: string[],
  showRefs: boolean,
  inlineChords: boolean = false,
  repeatChorus: boolean = true,
  showChords: boolean = true,
  chordNotation: ChordNotation = "letters",
): Promise<PrintSong[]> {
  const printSongs: PrintSong[] = [];

  for (const resolved of songs) {
    const songId = resolved.songId;
    const langs =
      resolved.lang != null
        ? [resolved.lang]
        : await getSongTranslations(songId).catch(() => []);
    const requested = resolved.lang != null
      ? [resolved.lang]
      : languages;

    const meta = showRefs ? await getSong(songId).catch(() => null) : null;

    for (const lang of requested) {
      if (!langs.includes(lang)) continue;
      try {
        const { meta: translationMeta, body, capo } = await getSongTranslation(songId, lang);
        // Skip unpublished translations
        if (!translationMeta.published) continue;
        const title = resolved.meta?.titles?.[lang]
          ?? (resolved.meta as { choTitles?: Record<string, string> } | null | undefined)?.choTitles?.[lang]
          ?? resolved.meta?.title
          ?? songId;
        const key = resolved.meta?.key ?? meta?.key;
        let html = renderToHtml(body, { inlineChords, repeatChorus, showChords, hideInstrumentals: !showChords });
        if (chordNotation !== "letters" && showChords) {
          html = applyNotation(html, chordNotation, key ?? null);
        }

        // Add footnote markers and reference list if references exist
        let refsHtml = '';
        if (showRefs && meta?.references?.length) {
          const sectionMap = buildSectionMap(body);
          const footnotes = buildFootnotes(meta.references, sectionMap, lang);
          
          if (footnotes.length > 0) {
            const bodyWithMarkers = injectMarkersIntoSource(body, new Map(
              footnotes.reduce((acc, fn) => {
                const arr = acc.get(fn.lineIndex) || [];
                arr.push({ index: fn.index, reference: fn.reference, lineIndex: fn.lineIndex, highlight: fn.highlight });
                acc.set(fn.lineIndex, arr);
                return acc;
              }, new Map<number, Footnote[]>())
            ));
            let htmlWithMarkers = renderToHtml(bodyWithMarkers, { inlineChords, repeatChorus, showChords, hideInstrumentals: !showChords });
            if (chordNotation !== "letters" && showChords) {
              htmlWithMarkers = applyNotation(htmlWithMarkers, chordNotation, key ?? null);
            }
            html = htmlWithMarkers;
            refsHtml = renderFootnoteListHtml(footnotes, lang);
          } else {
            // References exist but no footnotes (no locations), use standard rendering
            refsHtml = renderReferencesHtml(meta.references, lang);
          }
        }

        printSongs.push({
          id: songId,
          title,
          key,
          capo,
          lang,
          html,
          refsHtml,
        });
      } catch {
        // skip unreadable translation
      }
    }
  }

  return printSongs;
}

/**
 * Convert every chord token in the rendered sheet HTML to the target notation.
 * Mirrors the client-side conversion in ChordSheet.
 */
function applyNotation(html: string, notation: ChordNotation, keyRoot?: string | null): string {
  if (notation === "letters") return html;
  html = html.replace(
    /class="vce-chord"([^>]*)>([^<]+)<\/span>/g,
    (_m, attrs, chord) => `class="vce-chord"${attrs}>${convertChord(chord, notation, keyRoot ?? null)}</span>`,
  );
  html = html.replace(
    /class="vce-inline-chord"([^>]*)>([^<]+)<\/span>/g,
    (_m, attrs, chord) => `class="vce-inline-chord"${attrs}>${convertChord(chord, notation, keyRoot ?? null)}</span>`,
  );
  return html;
}