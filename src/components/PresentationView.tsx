"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { renderVisualChordSheet } from "@/lib/chordpro/visual-render";
import { SECTION_TYPES } from "@/lib/chordpro/chord-utils";
import { useTranslation } from "@/lib/i18n";
import {
  AUTO_ADVANCE_SPEED_OPTIONS,
  DEFAULT_AUTO_ADVANCE_SECONDS,
  speedOptionsWith,
} from "@/lib/auto-speed";
import { updateMyAutoAdvanceSpeedAction } from "@/app/actions";

const SECTION_TYPES_RE = SECTION_TYPES.join("|");
const START_OF_RE = new RegExp(
  `\\{(?:start_of_|s)(${SECTION_TYPES_RE})(?:\\s*:\\s*(.+?))?\\}`,
  "i"
);
const END_OF_RE = new RegExp(
  `\\{(?:end_of_|e)(${SECTION_TYPES_RE})\\}`,
  "i"
);

const AUTO_DELAY_STORAGE_KEY = "songbook-presentation-auto-delay";
const AUTO_ENABLED_STORAGE_KEY = "songbook-presentation-auto-enabled";

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
    // The leading start_of_* directive renders a section label, but the
    // presentation already shows it in the top bar — drop it from the block.
    const content = currentLines.filter(
      (l, i) => !(i === 0 && START_OF_RE.test(l.trim()))
    );
    const sectionSource = content.join("\n");
    sections.push({ label: currentLabel, rawHtml: renderVisualChordSheet(sectionSource) });
  }

  for (const line of lines) {
    const startMatch = line.match(START_OF_RE);
    const endMatch = line.match(END_OF_RE);
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
    sections.push({ label: "Song", rawHtml: renderVisualChordSheet(source) });
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
  initialAutoAdvanceSeconds,
}: {
  songId: string;
  title: string;
  source: string;
  isAudience: boolean;
  setlistSongs?: SetlistSong[];
  setlistTitle?: string;
  initialAutoAdvanceSeconds?: number;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const isSetlist = setlistSongs && setlistSongs.length > 1;
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showChords, setShowChords] = useState(!isAudience);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [autoDelay, setAutoDelay] = useState(
    initialAutoAdvanceSeconds ?? DEFAULT_AUTO_ADVANCE_SECONDS
  );

  const activeSong = isSetlist
    ? setlistSongs?.[currentSongIndex]
    : { songId, title, source };
  const sections = useMemo(
    () => (activeSong ? parseSections(activeSong.source) : []),
    [activeSong]
  );
  const total = sections.length;

  const songIdxRef = useRef(currentSongIndex);
  const secIdxRef = useRef(currentIndex);
  const totalRef = useRef(total);

  // Sync refs after each render
  useEffect(() => {
    songIdxRef.current = currentSongIndex;
    secIdxRef.current = currentIndex;
    totalRef.current = total;
  });

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentIndex((prev) => {
      if (prev === -1) return sections.length - 1;
      if (prev >= sections.length && sections.length > 0) return 0;
      return prev;
    });
  }, [sections]);

  // When switching songs forward, reset to section 0
  // This is handled by goNext returning 0 above

  // Restore the auto-advance preference. A saved profile value wins; the
  // browser value is the fallback for anonymous presenters.
  useEffect(() => {
    try {
      const storedDelay = Number(localStorage.getItem(AUTO_DELAY_STORAGE_KEY));
      if (initialAutoAdvanceSeconds == null && Number.isFinite(storedDelay) && storedDelay >= 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAutoDelay(storedDelay);
      }
      if (localStorage.getItem(AUTO_ENABLED_STORAGE_KEY) === "true") {
        setAutoAdvance(true);
      }
    } catch {
      // localStorage not available
    }
  }, [initialAutoAdvanceSeconds]);

  const toggleAutoAdvance = useCallback(() => {
    setAutoAdvance((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTO_ENABLED_STORAGE_KEY, String(next));
      } catch {
        // localStorage not available
      }
      return next;
    });
  }, []);

  const changeAutoDelay = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds)) return;
    const next = Math.min(300, Math.max(1, Math.round(seconds)));
    setAutoDelay(next);
    try {
      localStorage.setItem(AUTO_DELAY_STORAGE_KEY, String(next));
    } catch {
      // localStorage not available
    }
    void updateMyAutoAdvanceSpeedAction(next).catch(() => {});
  }, []);

  const isAtEnd =
    currentIndex >= total - 1 &&
    (!isSetlist || !setlistSongs || currentSongIndex >= setlistSongs.length - 1);

  // Auto-advance to the next section (and song in a setlist) after the
  // configured delay. The timer restarts after any manual navigation.
  useEffect(() => {
    if (!autoAdvance || isAtEnd || total === 0) return;
    const timer = setTimeout(goNext, autoDelay * 1000);
    return () => clearTimeout(timer);
  }, [autoAdvance, autoDelay, goNext, isAtEnd, total, currentIndex, currentSongIndex]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

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
        case "a":
        case "A":
          toggleAutoAdvance();
          break;
        case "Escape":
          router.back();
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, router, toggleAutoAdvance]);

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
            {showChords ? t('presentation.chordsOn') : t('presentation.chordsOff')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutoAdvance}
              className={`px-2 py-1 rounded ${autoAdvance ? "bg-blue-600" : "bg-neutral-800"}`}
              title={t('presentation.autoHint')}
            >
              {autoAdvance ? t('presentation.autoOn') : t('presentation.autoOff')}
            </button>
            <select
              value={autoDelay}
              onChange={(e) => changeAutoDelay(Number(e.target.value))}
              className="px-1 py-1 rounded bg-neutral-800 text-white"
              aria-label={t('presentation.speed')}
              title={t('presentation.speed')}
            >
              {speedOptionsWith(AUTO_ADVANCE_SPEED_OPTIONS, autoDelay).map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds}s
                </option>
              ))}
            </select>
          </div>
          <span data-testid="presentation-progress">
            {isSetlist && (
              <span className="mr-3">
                {t('presentation.song')} {currentSongIndex + 1}/{setlistSongs.length}
              </span>
            )}
            {(currentIndex >= 0 ? currentIndex : 0) + 1} / {total}
          </span>
          <button
            onClick={() => router.back()}
            className="px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
          >
            {t('presentation.esc')}
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
      <div className="max-w-full w-full px-4 sm:px-6 lg:px-8 text-center">
        <div
          className={`presentation-content ${showChords ? "" : "hide-chords"}`}
          dangerouslySetInnerHTML={{ __html: section?.rawHtml || "" }}
        />
      </div>

      {/* Navigation hint */}
      <div className="absolute bottom-4 text-neutral-600 text-xs">
        {t('presentation.navigationHint')}
      </div>
    </div>
  );
}
