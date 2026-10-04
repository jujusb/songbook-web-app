"use client";

import { useState, useMemo } from "react";
import ChordSheetJS from "chordsheetjs";
import { renderVisualChordSheet } from "@/lib/chordpro/visual-render";
import { SECTION_TYPES, splitSectionAliases } from "@/lib/chordpro/chord-utils";
import { getReferenceText, getHighlight } from "@/lib/content/references";
import { useTranslation } from "@/lib/i18n";

const SECTION_TYPES_RE = SECTION_TYPES.join("|");
const SECTION_MATCH_RE = new RegExp(
  `\\{(?:start_of_|s)(${SECTION_TYPES_RE})(?:\\s*:\\s*(.+?))?\\}`,
  "i"
);
const SECTION_REPEAT_MATCH_RE = new RegExp(
  `\\{(${SECTION_TYPES_RE})\\s*:\\s*(.+?)\\}`,
  "i"
);

interface ReferenceLocation {
  line?: number;
  verse?: string;
  chorus?: string;
  highlight?: string;
  highlights?: Record<string, string>;
}

interface Reference {
  type: string;
  label: string;
  target: string;
  line?: number;
  verse?: string;
  chorus?: string;
  text?: string;
  texts?: Record<string, string>;
  highlight?: string;
  highlights?: Record<string, string>;
  locations?: ReferenceLocation[];
}

interface Footnote {
  index: number;
  reference: Reference;
  lineIndex: number;
  highlight?: string; // per-location override
}

function renderSource(source: string): string {
  return renderVisualChordSheet(source, { repeatChorus: true });
}

function transposeSource(source: string, semitones: number): string {
  if (semitones === 0) return source;
  const parser = new ChordSheetJS.ChordProParser();
  const song = parser.parse(source);
  const transposed = song.transpose(semitones);
  const formatter = new ChordSheetJS.ChordProFormatter();
  return formatter.format(transposed);
}

/**
 * Parse ChordPro source and map section directives to content line indices.
 * Tracks the type (verse/chorus/bridge), the primary label and any alias
 * names registered by repeated sections, e.g. "{verse: 1. : 4.}" makes the
 * verse that replays "1." referenceable as "4." too.
 */
type SectionEntry = {
  type: string;
  label: string;
  startLine: number;
  aliases: string[];
};

function parseSectionMap(source: string): SectionEntry[] {
  const lines = source.split("\n");
  const sections: SectionEntry[] = [];
  let lineCounter = 0;

  for (const line of lines) {
    const match = line.match(SECTION_MATCH_RE);
    if (match) {
      const sectionType = match[1].toLowerCase(); // verse, chorus, bridge
      const label =
        match[2] ||
        sectionType.charAt(0).toUpperCase() + sectionType.slice(1);
      sections.push({ type: sectionType, label, startLine: lineCounter, aliases: [] });
    }
    if (
      line.trim() &&
      !line.trim().startsWith("{")
    ) {
      lineCounter++;
    }
  }

  // Attach aliases from repeated sections: "{verse: 1. : 4.}" replays the
  // section labelled "1." and registers "4." as an alternate reference name.
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.startsWith("{") ? trimmed.match(SECTION_REPEAT_MATCH_RE) : null;
    if (m) {
      const type = m[1].toLowerCase();
      const { primary, aliases } = splitSectionAliases(m[2]);
      if (aliases.length > 0) {
        const target = sections.find(
          (s) => s.type === type && s.label === primary
        );
        if (target) target.aliases.push(...aliases);
      }
    }
  }

  return sections;
}

/**
 * Resolve a single location (verse/chorus/line) to a content-line index.
 * Verse/chorus names match the section's primary label or any alias.
 */
function resolveLocation(
  loc: { line?: number; verse?: string; chorus?: string },
  sectionMap: SectionEntry[]
): number | null {
  if (loc.line !== undefined) return loc.line;
  const verse = loc.verse;
  const chorus = loc.chorus;
  if (verse) {
    const sec = sectionMap.find(
      (s) => s.type === "verse" && (s.label === verse || s.aliases.includes(verse))
    );
    if (sec) return sec.startLine;
  }
  if (chorus) {
    const sec = sectionMap.find(
      (s) =>
        s.type === "chorus" &&
        (!chorus || chorus === s.label || s.label === "Chorus" || s.aliases.includes(chorus))
    );
    if (sec) return sec.startLine;
  }
  return null;
}

/**
 * Build numbered footnotes from references.
 *
 * Each resolved location gets its own sequential index. Legacy single
 * `verse`/`chorus`/`line` fields are treated as a single location.
 */
function buildFootnotes(
  references: Reference[],
  sectionMap: SectionEntry[],
  lang: string
): Footnote[] {
  const footnotes: Footnote[] = [];
  let idx = 1;

  for (const ref of references) {
    const locs: (ReferenceLocation)[] = [];

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

/**
 * Inject footnote markers directly into ChordPro source text.
 * Appends ⁽¹⁾ style markers at the end of the target lyric lines
 * BEFORE the source is parsed by ChordSheetJS, so they render inline.
 */
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
      const markerText = fns.map((fn) => `(${fn.index})`).join(" ");
      result.push(line + " " + markerText);
    } else {
      result.push(line);
    }

    contentLineIndex++;
  }

  return result.join("\n");
}

function FootnoteLink({ fn }: { fn: Footnote }) {
  const r = fn.reference;
  if (r.type === "song") {
    return (
      <a
        href={`/songs/${r.target}`}
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {r.label}
      </a>
    );
  }
  if (r.type === "link") {
    return (
      <a
        href={r.target}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {r.label}
      </a>
    );
  }
  return (
    <span className="text-neutral-600 dark:text-neutral-400">{r.label}</span>
  );
}

function HighlightedText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight) {
    return <span>{text}</span>;
  }
  const index = text.indexOf(highlight);
  if (index === -1) {
    return <span>{text}</span>;
  }
  const before = text.slice(0, index);
  const after = text.slice(index + highlight.length);
  return (
    <span>
      {before}
      <mark className="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-0.5 rounded-sm">
        {highlight}
      </mark>
      {after}
    </span>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build HTML for reference text with inline footnote markers and highlights
 * embedded at each highlight position. Used for multi-location references
 * where different parts of the text are highlighted for different sections.
 */
function renderInlineRefText(
  text: string,
  entries: { index: number; highlight?: string; locLabel: string | null }[],
  prefix: string
): string {
  const highlights: { start: number; end: number; index: number }[] = [];
  for (const entry of entries) {
    const hl = entry.highlight;
    if (!hl) continue;
    const start = text.indexOf(hl);
    if (start === -1) continue;
    const end = start + hl.length;
    if (highlights.some((h) => h.start === start && h.end === end)) continue;
    highlights.push({ start, end, index: entry.index });
  }
  highlights.sort((a, b) => a.start - b.start);

  let html = escapeHtml(text);
  for (let i = highlights.length - 1; i >= 0; i--) {
    const h = highlights[i];
    const before = html.slice(0, h.start);
    const after = html.slice(h.end);
    const marker = `<a href="#${prefix}ref-${h.index}" class="ref-marker">(${h.index})</a>`;
    const marked = `<mark class="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-0.5 rounded-sm">${escapeHtml(text.slice(h.start, h.end))}</mark>`;
    html = before + marker + marked + after;
  }

  return html;
}

export function ChordSheet({
  initialSource,
  songKey,
  references = [],
  idPrefix = "",
  lang = "en",
}: {
  initialSource: string;
  songKey: string | null;
  references?: Reference[];
  idPrefix?: string;
  lang?: string;
}) {
  const { t } = useTranslation();
  const [semitones, setSemitones] = useState(0);

  // Build section map from the original source
  const sectionMap = useMemo(
    () => parseSectionMap(initialSource),
    [initialSource]
  );

  // Build numbered footnotes
  const footnotes = useMemo(
    () => buildFootnotes(references, sectionMap, lang),
    [references, sectionMap, lang]
  );

  // Group footnotes by line index
  const footnotesByLine = useMemo(() => {
    const map = new Map<number, Footnote[]>();
    for (const fn of footnotes) {
      const existing = map.get(fn.lineIndex) || [];
      existing.push(fn);
      map.set(fn.lineIndex, existing);
    }
    return map;
  }, [footnotes]);

  // Map line index to section name for display
  const sectionNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const sec of sectionMap) {
      let label = sec.type.charAt(0).toUpperCase() + sec.type.slice(1);
      if (sec.type === "verse" || sec.type === "chorus") {
        label = sec.label;
      }
      map.set(sec.startLine, label);
    }
    return map;
  }, [sectionMap]);

  // Group footnotes by reference — one entry per reference in the <ol>
  // showing comma-separated indices and per-location highlights
  const referenceGroups = useMemo(() => {
    return references
      .filter((ref) => footnotes.some((fn) => fn.reference === ref))
      .map((ref) => ({
        reference: ref,
        entries: footnotes
          .filter((fn) => fn.reference === ref)
          .sort((a, b) => a.index - b.index)
          .map((fn) => ({
            index: fn.index,
            lineIndex: fn.lineIndex,
            highlight: fn.highlight,
            locLabel: sectionNames.get(fn.lineIndex) ?? null,
          })),
      }));
  }, [references, footnotes, sectionNames]);

  // Transpose first, then inject markers, then render, then linkify markers
  const html = useMemo(() => {
    const transposed = transposeSource(initialSource, semitones);
    const withMarkers = injectMarkersIntoSource(transposed, footnotesByLine);
    let rendered = renderSource(withMarkers);

    // Post-process: turn plain-text (1), (2) etc. into clickable anchor links
    if (footnotes.length > 0) {
      const maxIndex = Math.max(...footnotes.map((fn) => fn.index));
      const prefix = idPrefix ? `${idPrefix}-` : "";

      // Build a map from any marker index to the group's anchor index
      const indexMap: Record<number, number> = {};
      for (const group of referenceGroups) {
        const anchor = group.entries[0].index;
        for (const e of group.entries) {
          indexMap[e.index] = anchor;
        }
      }

      rendered = rendered.replace(
        /\((\d+)\)/g,
        (match, num) => {
          const n = parseInt(num);
          const anchor = indexMap[n] || n;
          if (n >= 1 && n <= maxIndex) {
            return `<a href="#${prefix}ref-${anchor}" class="ref-marker">(${n})</a>`;
          }
          return match;
        }
      );
    }

    return rendered;
  }, [initialSource, semitones, footnotesByLine, footnotes.length, idPrefix, referenceGroups]);

  // General (non-line) references
  const generalRefs = references.filter(
    (r) =>
      r.line === undefined &&
      !r.verse &&
      !r.chorus &&
      (!r.locations || r.locations.length === 0)
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-neutral-500 shrink-0">{t('common.transpose')}:</span>
        <button
          type="button"
          onClick={() => setSemitones((s) => s - 1)}
          className="w-10 h-10 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-base font-mono transition-colors touch-manipulation"
          aria-label={t('common.transpose') + " down"}
        >
          &minus;
        </button>
        <span className="text-base font-mono w-10 text-center select-none">
          {semitones > 0 ? `+${semitones}` : semitones}
        </span>
        <button
          type="button"
          onClick={() => setSemitones((s) => s + 1)}
          className="w-10 h-10 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-base font-mono transition-colors touch-manipulation"
          aria-label={t('common.transpose') + " up"}
        >
          +
        </button>
        {semitones !== 0 && (
          <button
            type="button"
            onClick={() => setSemitones(0)}
            className="px-3 py-2 text-sm text-neutral-500 hover:text-foreground rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors touch-manipulation"
          >
            {t('common.reset')}
          </button>
        )}
        {songKey && (
          <span className="text-sm text-neutral-400 ml-2 shrink-0">
            {t('common.originalKey', { key: songKey })}
          </span>
        )}
      </div>

      {/* Chord sheet - responsive, fits screen without horizontal scroll */}
      <div className="w-full overflow-hidden">
        <div
          className="visual-chord-editor visual-chord-sheet"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Footnotes */}
      {referenceGroups.length > 0 && (
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
            References
          </div>
          <ol className="space-y-2.5">
            {referenceGroups.map((group) => {
              const prefix = idPrefix ? `${idPrefix}-` : "";
              const indicesStr = group.entries.map((e) => e.index).join(", ");
              const groupText = getReferenceText(group.reference, lang);
              const groupHl = group.entries[0].highlight ?? getHighlight(group.reference, lang);
              const hasInlineHighlights =
                group.entries.length > 1 &&
                group.entries.some((e) => e.highlight);
              const inlineHtml =
                hasInlineHighlights && groupText
                  ? renderInlineRefText(groupText, group.entries, prefix)
                  : null;
              return (
                <li key={indicesStr} id={`${prefix}ref-${group.entries[0].index}`} className="flex items-start gap-2 text-sm">
                  <a
                    href={`#${prefix}ref-${group.entries[0].index}`}
                    className="text-amber-600 dark:text-amber-400 font-bold text-xs mt-0.5 shrink-0 hover:underline"
                  >
                    ({indicesStr})
                  </a>
                <div>
                  <div>
                    <FootnoteLink fn={{ index: group.entries[0].index, reference: group.reference, lineIndex: group.entries[0].lineIndex }} />
                  </div>
                  {groupText && (
                    inlineHtml ? (
                      <div
                        className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed italic pl-2 border-l-2 border-neutral-200 dark:border-neutral-700"
                        dangerouslySetInnerHTML={{ __html: inlineHtml }}
                      />
                    ) : (
                      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed italic pl-2 border-l-2 border-neutral-200 dark:border-neutral-700">
                        <HighlightedText text={groupText} highlight={groupHl} />
                      </div>
                    )
                  )}
                </div>
              </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* General references */}
      {generalRefs.length > 0 && (
        <div
          className={`mt-4 ${footnotes.length === 0 ? "pt-4 border-t border-neutral-200 dark:border-neutral-800" : ""}`}
        >
          {footnotes.length === 0 && (
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
              References
            </div>
          )}
          {footnotes.length > 0 && (
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 mt-3">
              See Also
            </div>
          )}
          <ul className="space-y-2">
            {generalRefs.map((r, i) => (
              <li key={i}>
                <div className="text-sm">
                  {r.type === "song" ? (
                    <a
                      href={`/songs/${r.target}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {r.label}
                    </a>
                  ) : r.type === "link" ? (
                    <a
                      href={r.target}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {r.label}
                    </a>
                  ) : (
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {r.label}
                    </span>
                  )}
                </div>
                {(() => {
                  const text = getReferenceText(r, lang);
                  const hl = getHighlight(r, lang);
                  return text && (
                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed italic pl-2 border-l-2 border-neutral-200 dark:border-neutral-700">
                      <HighlightedText text={text} highlight={hl} />
                    </div>
                  );
                })()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
