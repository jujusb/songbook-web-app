"use client";

import { useState, useMemo } from "react";
import ChordSheetJS from "chordsheetjs";

interface Reference {
  type: string;
  label: string;
  target: string;
  line?: number;
  verse?: string;
  chorus?: string;
  text?: string;
  highlight?: string;
}

interface Footnote {
  index: number;
  reference: Reference;
  lineIndex: number;
}

function renderSource(source: string): string {
  const parser = new ChordSheetJS.ChordProParser();
  const song = parser.parse(source);
  const formatter = new ChordSheetJS.HtmlDivFormatter();
  return formatter.format(song);
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
 * Tracks both the type (verse/chorus/bridge) and the label.
 */
function parseSectionMap(
  source: string
): { type: string; label: string; startLine: number }[] {
  const lines = source.split("\n");
  const sections: { type: string; label: string; startLine: number }[] = [];
  let lineCounter = 0;

  for (const line of lines) {
    const match = line.match(
      /\{start_of_(verse|chorus|bridge)(?:\s*:\s*(.+?))?\}/i
    );
    if (match) {
      const sectionType = match[1].toLowerCase(); // verse, chorus, bridge
      const label =
        match[2] ||
        match[1].charAt(0).toUpperCase() + match[1].slice(1);
      sections.push({ type: sectionType, label, startLine: lineCounter });
    }
    if (
      line.trim() &&
      !line.trim().startsWith("{")
    ) {
      lineCounter++;
    }
  }
  return sections;
}

/**
 * Build numbered footnotes from references.
 * Matches verse: to {start_of_verse: X} and chorus: to {start_of_chorus: X}.
 */
function buildFootnotes(
  references: Reference[],
  sectionMap: { type: string; label: string; startLine: number }[]
): Footnote[] {
  const footnotes: Footnote[] = [];
  let idx = 1;

  for (const ref of references) {
    if (ref.line !== undefined) {
      footnotes.push({ index: idx++, reference: ref, lineIndex: ref.line });
    } else if (ref.verse) {
      // Match verse: value against {start_of_verse: value}
      const sec = sectionMap.find(
        (s) => s.type === "verse" && s.label === ref.verse
      );
      if (sec) {
        footnotes.push({
          index: idx++,
          reference: ref,
          lineIndex: sec.startLine,
        });
      }
    } else if (ref.chorus) {
      // Match chorus: value against {start_of_chorus: value}
      // Also match if chorus is just "true" or empty — matches any chorus
      const sec = sectionMap.find(
        (s) => s.type === "chorus" && (!ref.chorus || ref.chorus === s.label || s.label === "Chorus")
      );
      if (sec) {
        footnotes.push({
          index: idx++,
          reference: ref,
          lineIndex: sec.startLine,
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

export function ChordSheet({
  initialSource,
  songKey,
  references = [],
  idPrefix = "",
}: {
  initialSource: string;
  songKey: string | null;
  references?: Reference[];
  idPrefix?: string;
}) {
  const [semitones, setSemitones] = useState(0);

  // Build section map from the original source
  const sectionMap = useMemo(
    () => parseSectionMap(initialSource),
    [initialSource]
  );

  // Build numbered footnotes
  const footnotes = useMemo(
    () => buildFootnotes(references, sectionMap),
    [references, sectionMap]
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

  // Transpose first, then inject markers, then render, then linkify markers
  const html = useMemo(() => {
    const transposed = transposeSource(initialSource, semitones);
    const withMarkers = injectMarkersIntoSource(transposed, footnotesByLine);
    let rendered = renderSource(withMarkers);

    // Post-process: turn plain-text (1), (2) etc. into clickable anchor links
    if (footnotes.length > 0) {
      const prefix = idPrefix ? `${idPrefix}-` : "";
      rendered = rendered.replace(
        /\((\d+)\)/g,
        (match, num) => {
          const n = parseInt(num);
          if (n >= 1 && n <= footnotes.length) {
            return `<a href="#${prefix}ref-${n}" class="ref-marker">(${n})</a>`;
          }
          return match;
        }
      );
    }

    return rendered;
  }, [initialSource, semitones, footnotesByLine, footnotes.length, idPrefix]);

  // General (non-line) references
  const generalRefs = references.filter(
    (r) => r.line === undefined && !r.verse && !r.chorus
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-neutral-500">Transpose:</span>
        <button
          type="button"
          onClick={() => setSemitones((s) => s - 1)}
          className="w-8 h-8 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm font-mono"
        >
          -
        </button>
        <span className="text-sm font-mono w-8 text-center">
          {semitones > 0 ? `+${semitones}` : semitones}
        </span>
        <button
          type="button"
          onClick={() => setSemitones((s) => s + 1)}
          className="w-8 h-8 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm font-mono"
        >
          +
        </button>
        {semitones !== 0 && (
          <button
            type="button"
            onClick={() => setSemitones(0)}
            className="text-xs text-neutral-500 hover:text-foreground ml-1"
          >
            Reset
          </button>
        )}
        {songKey && (
          <span className="text-xs text-neutral-400 ml-2">
            Original key: {songKey}
          </span>
        )}
      </div>

      {/* Chord sheet */}
      <div
        className="chord-sheet"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Footnotes */}
      {footnotes.length > 0 && (
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
            References
          </div>
          <ol className="space-y-2.5">
            {footnotes.map((fn) => {
              const prefix = idPrefix ? `${idPrefix}-` : "";
              return (
                <li key={fn.index} id={`${prefix}ref-${fn.index}`} className="flex items-start gap-2 text-sm">
                  <a
                    href={`#${prefix}ref-${fn.index}`}
                    className="text-amber-600 dark:text-amber-400 font-bold text-xs mt-0.5 shrink-0 hover:underline"
                  >
                    ({fn.index})
                  </a>
                <div>
                  <FootnoteLink fn={fn} />
                  {fn.reference.verse && (
                    <span className="text-xs text-neutral-400 ml-1">
                      &mdash; {fn.reference.verse}
                    </span>
                  )}
                  {fn.reference.chorus && (
                    <span className="text-xs text-neutral-400 ml-1">
                      &mdash; {fn.reference.chorus}
                    </span>
                  )}
                  {fn.reference.line !== undefined && !fn.reference.verse && !fn.reference.chorus && (
                    <span className="text-xs text-neutral-400 ml-1">
                      &mdash; line {fn.reference.line + 1}
                    </span>
                  )}
                  {fn.reference.text && (
                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed italic pl-2 border-l-2 border-neutral-200 dark:border-neutral-700">
                      <HighlightedText text={fn.reference.text} highlight={fn.reference.highlight} />
                    </div>
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
                {r.text && (
                  <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed italic pl-2 border-l-2 border-neutral-200 dark:border-neutral-700">
                    <HighlightedText text={r.text} highlight={r.highlight} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
