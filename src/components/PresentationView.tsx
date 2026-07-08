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
  const formatter = new ChordSheetJS.HtmlDivFormatter();

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

export function PresentationView({
  songId,
  title,
  source,
  isAudience,
}: {
  songId: string;
  title: string;
  source: string;
  isAudience: boolean;
}) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showChords, setShowChords] = useState(!isAudience);

  const sections = useMemo(() => parseSections(source), [source]);
  const total = sections.length;

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

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
          router.push(`/songs/${songId}`);
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, router, songId]);

  const section = sections[currentIndex];

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center z-[100]">
      {/* Title bar */}
      <div className="absolute top-0 left-0 right-0 px-6 py-3 flex items-center justify-between opacity-50 hover:opacity-100 transition-opacity">
        <span className="text-sm">{title}</span>
        <div className="flex items-center gap-4 text-xs">
          <button
            onClick={() => setShowChords((s) => !s)}
            className={`px-2 py-1 rounded ${showChords ? "bg-blue-600" : "bg-neutral-800"}`}
          >
            Chords {showChords ? "ON" : "OFF"}
          </button>
          <span>
            {currentIndex + 1} / {total}
          </span>
          <button
            onClick={() => router.push(`/songs/${songId}`)}
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
