"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import {
  parseChordProSource,
  directiveLabel,
  linesToChordPro,
  type ParsedLine,
} from "@/lib/chordpro/visual-parse";

type ChordRef = { chord: string; position: number };

// Re-map chord positions when lyrics change: keep chords aligned to the text
// they were attached to. Uses a common-prefix/suffix diff to locate the edit.
function shiftChordPositions(
  chords: ChordRef[],
  oldLyrics: string,
  newLyrics: string,
): ChordRef[] {
  let prefix = 0;
  while (
    prefix < oldLyrics.length &&
    prefix < newLyrics.length &&
    oldLyrics[prefix] === newLyrics[prefix]
  ) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < oldLyrics.length - prefix &&
    suffix < newLyrics.length - prefix &&
    oldLyrics[oldLyrics.length - 1 - suffix] ===
      newLyrics[newLyrics.length - 1 - suffix]
  ) {
    suffix++;
  }

  const oldEnd = oldLyrics.length - suffix;
  const newEnd = newLyrics.length - suffix;
  const delta = newEnd - oldEnd;

  return chords.map((c) => {
    if (c.position < prefix) return c;
    if (c.position >= oldEnd) {
      return { ...c, position: Math.min(c.position + delta, newLyrics.length) };
    }
    return { ...c, position: Math.min(prefix, newLyrics.length) };
  });
}

/* ─── Component ─── */

export function VisualChordEditor({
  source,
  onChange,
}: {
  source: string;
  onChange: (newSource: string) => void;
}) {
  const [lines, setLines] = useState<ParsedLine[]>(() => parseChordProSource(source));
  const [selectedChord, setSelectedChord] = useState<{
    lineIdx: number;
    chordIdx: number;
  } | null>(null);
  const [addingChord, setAddingChord] = useState<number | null>(null); // lineIdx
  const [newChordName, setNewChordName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef(lines);

  // Keep a mutable mirror of lines so rapid edits never read stale state
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  // Keep lines in sync when source changes externally
  const prevSourceRef = useRef(source);
  useEffect(() => {
    if (source !== prevSourceRef.current) {
      const parsed = parseChordProSource(source);
      linesRef.current = parsed;
      setLines(parsed);
      prevSourceRef.current = source;
    }
  }, [source]);

  // Emit changes
  const emitChange = useCallback(
    (newLines: ParsedLine[]) => {
      linesRef.current = newLines;
      setLines(newLines);
      const newSource = linesToChordPro(newLines);
      prevSourceRef.current = newSource;
      onChange(newSource);
    },
    [onChange]
  );

  // Move selected chord left/right
  const moveChord = useCallback(
    (direction: -1 | 1) => {
      if (!selectedChord) return;
      const { lineIdx, chordIdx } = selectedChord;
      const newLines = lines.map((l, i) => {
        if (i !== lineIdx) return l;
        const newChords = l.chords.map((c, j) => {
          if (j !== chordIdx) return c;
          const newPos = c.position + direction;
          if (newPos < 0 || newPos > l.lyrics.length) return c;
          return { ...c, position: newPos };
        });
        return { ...l, chords: newChords };
      });
      emitChange(newLines);
    },
    [selectedChord, lines, emitChange]
  );

  // Delete selected chord
  const deleteChord = useCallback(() => {
    if (!selectedChord) return;
    const { lineIdx, chordIdx } = selectedChord;
    const newLines = lines.map((l, i) => {
      if (i !== lineIdx) return l;
      return { ...l, chords: l.chords.filter((_, j) => j !== chordIdx) };
    });
    setSelectedChord(null);
    emitChange(newLines);
  }, [selectedChord, lines, emitChange]);

  // Edit selected chord name
  const renameChord = useCallback(
    (newName: string) => {
      if (!selectedChord) return;
      const { lineIdx, chordIdx } = selectedChord;
      const newLines = lines.map((l, i) => {
        if (i !== lineIdx) return l;
        const newChords = l.chords.map((c, j) => {
          if (j !== chordIdx) return c;
          return { ...c, chord: newName };
        });
        return { ...l, chords: newChords };
      });
      emitChange(newLines);
    },
    [selectedChord, lines, emitChange]
  );

  // Add chord to a line at a position (click on lyrics)
  const addChordAtPosition = useCallback(
    (lineIdx: number, position: number, chordName: string) => {
      if (!chordName.trim()) return;
      const newLines = lines.map((l, i) => {
        if (i !== lineIdx) return l;
        const newChords = [...l.chords, { chord: chordName.trim(), position }];
        newChords.sort((a, b) => a.position - b.position);
        return { ...l, chords: newChords };
      });
      emitChange(newLines);
    },
    [lines, emitChange]
  );

  // Edit lyrics text — chords follow the edited text on the line
  const updateLyrics = useCallback(
    (lineIdx: number, newLyrics: string) => {
      const newLines = linesRef.current.map((l, i) => {
        if (i !== lineIdx) return l;
        const newChords = shiftChordPositions(
          l.chords,
          l.lyrics,
          newLyrics,
        );
        return { ...l, lyrics: newLyrics, chords: newChords };
      });
      emitChange(newLines);
    },
    [emitChange]
  );

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedChord) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveChord(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        moveChord(1);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Only if not focusing an input
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        e.preventDefault();
        deleteChord();
      } else if (e.key === "Escape") {
        setSelectedChord(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedChord, moveChord, deleteChord]);

  // Click outside to deselect
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setSelectedChord(null);
        setAddingChord(null);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="visual-chord-editor">
      {/* Toolbar */}
      {selectedChord && (
        <div className="vce-toolbar">
          <span className="vce-toolbar-label">Chord:</span>
          <input
            type="text"
            className="vce-chord-input"
            value={lines[selectedChord.lineIdx]?.chords[selectedChord.chordIdx]?.chord || ""}
            onChange={(e) => renameChord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <button
            className="vce-btn"
            onMouseDown={(e) => { e.preventDefault(); moveChord(-1); }}
            title="Move chord left"
          >
            &larr;
          </button>
          <button
            className="vce-btn"
            onMouseDown={(e) => { e.preventDefault(); moveChord(1); }}
            title="Move chord right"
          >
            &rarr;
          </button>
          <button
            className="vce-btn vce-btn-danger"
            onMouseDown={(e) => { e.preventDefault(); deleteChord(); }}
            title="Delete chord"
          >
            Delete
          </button>
          <span className="vce-toolbar-hint">
            Arrow keys to move, Del to remove, Esc to deselect
          </span>
        </div>
      )}

      {!selectedChord && (
        <div className="vce-toolbar vce-toolbar-hint">
          Click a chord to select it. Double-click lyrics to add a chord.
        </div>
      )}

      {/* Lines */}
      <div className="vce-lines">
        {lines.map((line, lineIdx) => {
          if (line.type === "directive") {
            const label = directiveLabel(line.raw);
            if (label) {
              return (
                <div key={lineIdx} className="vce-section-label">
                  {label}
                </div>
              );
            }
            return null; // end_of directives: skip
          }

          if (!line.lyrics && line.chords.length === 0) {
            return <div key={lineIdx} className="vce-empty-line" />;
          }

          return (
            <ContentLine
              key={lineIdx}
              line={line}
              lineIdx={lineIdx}
              selectedChord={selectedChord}
              onSelectChord={(chordIdx) =>
                setSelectedChord({ lineIdx, chordIdx })
              }
              onUpdateLyrics={(newLyrics) => updateLyrics(lineIdx, newLyrics)}
              onAddChord={(pos, name) => addChordAtPosition(lineIdx, pos, name)}
              addingChord={addingChord === lineIdx}
              onStartAddChord={() => {
                setAddingChord(lineIdx);
                setSelectedChord(null);
              }}
              newChordName={newChordName}
              setNewChordName={setNewChordName}
              setAddingChord={setAddingChord}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── ContentLine sub-component ─── */

function ContentLine({
  line,
  lineIdx,
  selectedChord,
  onSelectChord,
  onUpdateLyrics,
  onAddChord,
  addingChord,
  onStartAddChord,
  newChordName,
  setNewChordName,
  setAddingChord,
}: {
  line: ParsedLine;
  lineIdx: number;
  selectedChord: { lineIdx: number; chordIdx: number } | null;
  onSelectChord: (chordIdx: number) => void;
  onUpdateLyrics: (newLyrics: string) => void;
  onAddChord: (pos: number, name: string) => void;
  addingChord: boolean;
  onStartAddChord: () => void;
  newChordName: string;
  setNewChordName: (v: string) => void;
  setAddingChord: (v: number | null) => void;
}) {
  const lyricsRef = useRef<HTMLDivElement>(null);
  const userEditingRef = useRef(false);
  const [addPos, setAddPos] = useState(0);
  const [addPosPx, setAddPosPx] = useState(0);

  // Push text into the contentEditable only for external changes (mount,
  // imports, code-mode edits). While the user is typing, the DOM is already
  // up to date and rewriting it would move the caret.
  useLayoutEffect(() => {
    const el = lyricsRef.current;
    if (!el) return;
    if (userEditingRef.current) return;
    const current = el.textContent || "";
    if (current !== line.lyrics) {
      el.textContent = line.lyrics;
    }
  }, [line.lyrics]);

  // Live lyric editing: commit on every keystroke so chord positions track
  // the text immediately, without blurring.
  const handleLyricsInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const newText = el.textContent || "";
      userEditingRef.current = true;
      if (newText !== line.lyrics) {
        onUpdateLyrics(newText);
      }
    },
    [line.lyrics, onUpdateLyrics]
  );

  const handleLyricsBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      userEditingRef.current = false;
      const newText = e.currentTarget.textContent || "";
      if (newText !== line.lyrics) {
        onUpdateLyrics(newText);
      }
    },
    [line.lyrics, onUpdateLyrics]
  );

  // Build the chord row: position chords by character index
  // Using a monospace approach: each char = fixed width, chords float above
  const sortedChords = useMemo(
    () => [...line.chords].sort((a, b) => a.position - b.position),
    [line.chords]
  );

  // Map sorted indices back to original indices
  const chordOriginalIndices = useMemo(() => {
    return sortedChords.map((sc) =>
      line.chords.findIndex(
        (c) => c.chord === sc.chord && c.position === sc.position
      )
    );
  }, [sortedChords, line.chords]);

  // Build chord row as spans with spacing
  const chordElements = useMemo(() => {
    const elements: React.ReactNode[] = [];
    let currentPos = 0;

    sortedChords.forEach((cp, sortedIdx) => {
      const origIdx = chordOriginalIndices[sortedIdx];
      const isSelected =
        selectedChord?.lineIdx === lineIdx &&
        selectedChord?.chordIdx === origIdx;

      // Add spacing before this chord
      if (cp.position > currentPos) {
        const spaces = cp.position - currentPos;
        elements.push(
          <span key={`space-${sortedIdx}`} className="vce-chord-space">
            {"\u00A0".repeat(spaces)}
          </span>
        );
      }

      elements.push(
        <span
          key={`chord-${sortedIdx}`}
          className={`vce-chord ${isSelected ? "vce-chord-selected" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelectChord(origIdx);
          }}
          title={`${cp.chord} at position ${cp.position}`}
        >
          {cp.chord}
        </span>
      );

      currentPos = cp.position + cp.chord.length;
    });

    return elements;
  }, [sortedChords, chordOriginalIndices, selectedChord, lineIdx, onSelectChord]);

  // Handle double-click on lyrics to add a chord. The popup is positioned in
  // pixels from the real, rendered glyph advances (measured via canvas with the
  // exact computed font) so it always lands under the cursor regardless of the
  // resolved font's metrics.
  const handleLyricsDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = lyricsRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const padLeft = parseFloat(style.paddingLeft) || 0;
      const text = el.textContent ?? "";
      if (!text.trim().length) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.font = style.font;

      // Cumulative advance width up to each character boundary.
      const cum: number[] = [0];
      for (let i = 0; i < text.length; i++) {
        cum.push(cum[i] + ctx.measureText(text[i]).width);
      }

      const xIn = e.clientX - rect.left - padLeft;

      // Snap to the nearest character boundary.
      let best = Math.min(cum.length - 1, line.lyrics.length);
      let bestDiff = Infinity;
      for (let i = 0; i <= Math.min(cum.length - 1, line.lyrics.length); i++) {
        const diff = Math.abs(cum[i] - xIn);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      }

      setAddPos(best);
      setAddPosPx(padLeft + cum[best]);
      setNewChordName("");
      onStartAddChord();
    },
    [line.lyrics.length, onStartAddChord, setNewChordName]
  );

  const handleAddChordSubmit = useCallback(() => {
    if (newChordName.trim()) {
      onAddChord(addPos, newChordName.trim());
    }
    setAddingChord(null);
    setNewChordName("");
  }, [addPos, newChordName, onAddChord, setAddingChord, setNewChordName]);

  return (
    <div className="vce-line">
      {/* Chord row */}
      <div className="vce-chord-row">
        {chordElements}
        {chordElements.length === 0 && (
          <span className="vce-chord-placeholder">&nbsp;</span>
        )}
      </div>

      {/* Lyrics row */}
      <div className="vce-lyrics-row">
        <div
          ref={lyricsRef}
          className="vce-lyrics-text"
          contentEditable
          suppressContentEditableWarning
          onInput={handleLyricsInput}
          onBlur={handleLyricsBlur}
          onDoubleClick={handleLyricsDoubleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLElement).blur();
            }
          }}
        />

        {/* Add chord popup */}
        {addingChord && (
          <div
            className="vce-add-chord-popup"
            style={{ left: `${addPosPx}px` }}
          >
            <input
              autoFocus
              type="text"
              className="vce-add-chord-input"
              placeholder="e.g. Am"
              value={newChordName}
              onChange={(e) => setNewChordName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddChordSubmit();
                if (e.key === "Escape") {
                  setAddingChord(null);
                  setNewChordName("");
                }
              }}
              onBlur={handleAddChordSubmit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
