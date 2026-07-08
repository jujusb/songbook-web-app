"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import ChordSheetJS from "chordsheetjs";

interface Section {
  label: string;
  rawHtml: string;
}

function parseSections(source: string): Section[] {
  // Split the source into section blocks by tracking start_of/end_of directives
  const lines = source.split("\n");
  const sections: Section[] = [];
  let currentLabel = "";
  let currentLines: string[] = [];
  let inSection = false;
  const sectionStack: string[] = [];
  let lastChorusLabel = "";
  let lastChorusHtml = "";

  function flushSection() {
    if (!currentLabel || currentLines.length === 0) return;
    const sectionSource = currentLines.join("\n");
    // Render this section independently through the formatter
    const parser = new ChordSheetJS.ChordProParser();
    const song = parser.parse(sectionSource);
    const formatter = new ChordSheetJS.HtmlDivFormatter({ expandChorusDirective: true });
    const html = formatter.format(song);
    sections.push({ label: currentLabel, rawHtml: html });
  }

  for (const line of lines) {
    const startMatch = line.match(
      /\{(?:start_of_|s)(verse|chorus|bridge)(?:\s*:\s*(.+?))?\}/i
    );
    const endMatch = line.match(
      /\{(?:end_of_|e)(verse|chorus|bridge)\}/i
    );
    const isChorusRepeat = /^\{chorus\}$/i.test(line.trim());

    if (isChorusRepeat && lastChorusHtml) {
      // Create a copy of the last chorus section
      sections.push({ label: lastChorusLabel, rawHtml: lastChorusHtml });
      continue;
    }

    if (startMatch) {
      flushSection();
      currentLabel = startMatch[2] || startMatch[1].charAt(0).toUpperCase() + startMatch[1].slice(1);
      currentLines = [line];
      inSection = true;
      sectionStack.push(startMatch[1].toLowerCase());
    } else if (endMatch && inSection) {
      currentLines.push(line);
      sectionStack.pop();
      if (sectionStack.length === 0) {
        flushSection();
        // Remember the last chorus for {chorus} repeats
        if (currentLabel && /chorus/i.test(currentLabel) && sections.length > 0) {
          const last = sections[sections.length - 1];
          lastChorusLabel = last.label;
          lastChorusHtml = last.rawHtml;
        }
        currentLabel = "";
        currentLines = [];
        inSection = false;
      }
    } else if (inSection) {
      currentLines.push(line);
    }
  }

  // Flush any remaining section
  flushSection();

  // Fallback: no sections found
  if (sections.length === 0) {
    const parser = new ChordSheetJS.ChordProParser();
    const song = parser.parse(source);
    const formatter = new ChordSheetJS.HtmlDivFormatter({ expandChorusDirective: true });
    sections.push({ label: "Song", rawHtml: formatter.format(song) });
  }

  return sections;
}

interface SetlistSong {
  songId: string;
  title: string;
  source: string;
}

export function PresentationView({
  songId,
  title,
  source,
  isAudience,
  setlistSongs,
  setlistTitle,
}: {
  songId: string;
  title: string;
  source: string;
  isAudience: boolean;
  setlistSongs?: SetlistSong[];
  setlistTitle?: string;
}) {
  const router = useRouter();
  const isSetlist = setlistSongs && setlistSongs.length > 1;
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showChords, setShowChords] = useState(!isAudience);

  const activeSong = isSetlist
    ? setlistSongs?.[currentSongIndex]
    : { songId, title, source };
  const sections = useMemo(
    () => (activeSong ? parseSections(activeSong.source) : []),
    [activeSong?.source]
  );
  const total = sections.length;

  const songIdxRef = useRef(currentSongIndex);
  const secIdxRef = useRef(currentIndex);
  const totalRef = useRef(total);

  songIdxRef.current = currentSongIndex;
  secIdxRef.current = currentIndex;
  totalRef.current = total;

  const goNext = useCallback(() => {
    const ci = secIdxRef.current;
    const csi = songIdxRef.current;
    const t = totalRef.current;

    if (ci < t - 1) {
      setCurrentIndex(ci + 1);
    } else if (
      isSetlist &&
      setlistSongs &&
      csi < setlistSongs.length - 1
    ) {
      setCurrentSongIndex(csi + 1);
      setCurrentIndex(0);
    }
  }, [isSetlist, setlistSongs]);

  const goPrev = useCallback(() => {
    const ci = secIdxRef.current;
    const csi = songIdxRef.current;

    if (ci > 0) {
      setCurrentIndex(ci - 1);
    } else if (isSetlist && setlistSongs && csi > 0) {
      setCurrentSongIndex(csi - 1);
      setCurrentIndex(-1);
    }
  }, [isSetlist, setlistSongs]);

  // Fix currentIndex when sections change (new song via goPrev sentinel -1,
  // or safety clamp for goNext when sections length differs)
  useEffect(() => {
    setCurrentIndex((prev) => {
      if (prev === -1) return sections.length - 1;
      if (prev >= sections.length && sections.length > 0) return 0;
      return prev;
    });
  }, [sections]);

  // When switching songs forward, reset to section 0
  // This is handled by goNext returning 0 above

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "c":
        case "C":
          setShowChords((s) => !s);
          break;
        case "Escape":
          router.back();
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, router]);

  const section = sections[currentIndex >= 0 ? currentIndex : 0];

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center z-[100]">
      {/* Title bar */}
      <div className="absolute top-0 left-0 right-0 px-6 py-3 flex items-center justify-between opacity-50 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-3 min-w-0">
          {isSetlist && (
            <span className="text-xs text-neutral-500">{setlistTitle}</span>
          )}
          <span className="text-sm truncate">{activeSong.title}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <button
            onClick={() => setShowChords((s) => !s)}
            className={`px-2 py-1 rounded ${showChords ? "bg-blue-600" : "bg-neutral-800"}`}
          >
            Chords {showChords ? "ON" : "OFF"}
          </button>
          <span>
            {isSetlist && (
              <span className="mr-3">
                Song {currentSongIndex + 1}/{setlistSongs.length}
              </span>
            )}
            {(currentIndex >= 0 ? currentIndex : 0) + 1} / {total}
          </span>
          <button
            onClick={() => router.back()}
            className="px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
          >
            ESC
          </button>
        </div>
      </div>

      {/* Section label */}
      {section?.label && (
        <div className="absolute top-14 text-neutral-500 text-sm uppercase tracking-widest">
          {section.label}
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl w-full px-8 text-center">
        <div
          className={`presentation-content ${showChords ? "" : "hide-chords"}`}
          dangerouslySetInnerHTML={{ __html: section?.rawHtml || "" }}
        />
      </div>

      {/* Navigation hint */}
      <div className="absolute bottom-4 text-neutral-600 text-xs">
        Arrow keys or Space to navigate &middot; C to toggle chords &middot; ESC
        to exit
      </div>
    </div>
  );
}
