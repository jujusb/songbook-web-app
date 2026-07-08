"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import ChordSheetJS from "chordsheetjs";

interface Section {
  label: string;
  lines: { chords: string; lyrics: string }[];
  rawHtml: string;
}

function parseSections(source: string): Section[] {
  const parser = new ChordSheetJS.ChordProParser();
  const song = parser.parse(source);
  const formatter = new ChordSheetJS.HtmlDivFormatter({ expandChorusDirective: true });

  const sections: Section[] = [];

  for (const line of song.lines) {
    // Check if this is a section start (has a tag like start_of_verse, start_of_chorus)
    const sectionTag = line.items?.find(
      (item: any) => item.type === "tag" && item.name?.startsWith("start_of_")
    ) as any;

    if (sectionTag) {
      sections.push({
        label: sectionTag.value || sectionTag.name?.replace("start_of_", "") || "Section",
        lines: [],
        rawHtml: "",
      });
      continue;
    }

    const endTag = line.items?.find(
      (item: any) => item.type === "tag" && item.name?.startsWith("end_of_")
    );
    if (endTag) continue;

    // Add content lines to current section
    const currentSection =
      sections.length > 0 ? sections[sections.length - 1] : null;
    if (!currentSection) {
      // Lines before any section
      if (line.items && line.items.length > 0) {
        sections.push({ label: "", lines: [], rawHtml: "" });
      }
      continue;
    }

    const chords: string[] = [];
    const lyrics: string[] = [];
    if (line.items) {
      for (const item of line.items) {
        if ((item as any).chords) chords.push((item as any).chords);
        if ((item as any).lyrics) lyrics.push((item as any).lyrics);
      }
    }
    if (chords.length > 0 || lyrics.join("").trim()) {
      currentSection.lines.push({
        chords: chords.join(" "),
        lyrics: lyrics.join(""),
      });
    }
  }

  // Generate HTML for each section individually
  // We'll use a simpler approach: split the full HTML by section
  const fullHtml = formatter.format(song);
  // For simplicity, assign fullHtml to first section if we can't split
  if (sections.length > 0) {
    // Split on section markers in the HTML
    const sectionDivs = fullHtml.split(/<div class="[^"]*section[^"]*">/);
    for (let i = 0; i < sections.length; i++) {
      if (sectionDivs[i + 1]) {
        sections[i].rawHtml = `<div class="chord-sheet-section">${sectionDivs[i + 1]}`;
      }
    }
  }

  // Fallback: if no sections found, treat entire content as one section
  if (sections.length === 0) {
    sections.push({
      label: "Song",
      lines: [{ chords: "", lyrics: source }],
      rawHtml: formatter.format(song),
    });
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

  const activeSong = isSetlist ? setlistSongs[currentSongIndex] : { songId, title, source };
  const sections = useMemo(() => parseSections(activeSong.source), [activeSong.source]);
  const total = sections.length;

  const goNext = useCallback(() => {
    setCurrentIndex((i) => {
      if (i < total - 1) return i + 1;
      // At last section — advance to next song in setlist
      if (isSetlist && currentSongIndex < setlistSongs.length - 1) {
        setCurrentSongIndex((si) => si + 1);
        return 0; // reset to first section of new song (will be set via effect)
      }
      return i;
    });
  }, [total, isSetlist, currentSongIndex, setlistSongs?.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => {
      if (i > 0) return i - 1;
      // At first section — go back to previous song's last section
      if (isSetlist && currentSongIndex > 0) {
        setCurrentSongIndex((si) => si - 1);
        return -1; // sentinel — will be corrected by effect
      }
      return i;
    });
  }, [isSetlist, currentSongIndex]);

  // When changing songs, reset section index (handle the -1 sentinel for going backward)
  useEffect(() => {
    if (currentIndex === -1) {
      // Going backward — jump to last section of the new song
      // Need to wait for sections to update, so use a small delay
      setCurrentIndex(0); // will be corrected once sections are recalculated
    }
  }, [currentSongIndex, currentIndex]);

  // When sections change (new song), fix the -1 sentinel
  useEffect(() => {
    setCurrentIndex((prev) => {
      if (prev === -1) return sections.length - 1;
      if (prev >= sections.length) return 0;
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
      <div className="max-w-4xl w-full px-8 text-center">
        {section?.rawHtml ? (
          <div
            className={`presentation-content ${showChords ? "" : "hide-chords"}`}
            dangerouslySetInnerHTML={{ __html: section.rawHtml }}
          />
        ) : (
          <div className="space-y-2">
            {section?.lines.map((line, i) => (
              <div key={i}>
                {showChords && line.chords && (
                  <div className="text-blue-400 font-bold text-2xl">
                    {line.chords}
                  </div>
                )}
                <div className="text-4xl font-light leading-relaxed">
                  {line.lyrics}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation hint */}
      <div className="absolute bottom-4 text-neutral-600 text-xs">
        Arrow keys or Space to navigate &middot; C to toggle chords &middot; ESC
        to exit
      </div>
    </div>
  );
}
