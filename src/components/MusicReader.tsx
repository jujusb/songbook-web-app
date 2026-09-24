"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

export interface AudioFileEntry {
  lang: string;
  voice: string;
  path: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function trackLabel(file: AudioFileEntry): string {
  // Extract a readable label from the path basename
  const raw = file.path.split("/").pop() || "";
  const name = decodeURIComponent(raw);
  const withoutExt = name.replace(/\.\w+$/, "");
  // Remove leading track numbers like "05 - ", "001 - "
  return withoutExt.replace(/^[\d]+\s*-\s*/, "").trim() || file.voice;
}

/* ------------------------------------------------------------------ */
/*  Track grouping                                                    */
/* ------------------------------------------------------------------ */

interface TrackGroup {
  id: string;
  label: string;
  files: AudioFileEntry[];
}

function groupTracks(files: AudioFileEntry[]): TrackGroup[] {
  const groups: TrackGroup[] = [];

  // "full" → Original
  const original = files.filter((f) => f.voice === "full");
  if (original.length > 0) {
    groups.push({ id: "original", label: "Original", files: original });
  }

  // "all" → Full Mix
  const fullMix = files.filter((f) => f.voice === "all");
  if (fullMix.length > 0) {
    groups.push({ id: "full", label: "Full Mix", files: fullMix });
  }

  // "guide" → Guide
  const guide = files.filter((f) => f.voice === "guide");
  if (guide.length > 0) {
    groups.push({ id: "guide", label: "Voice Guide", files: guide });
  }

  // feminine / masculine → Voices
  const feminine = files.filter((f) => f.voice === "feminine");
  const masculine = files.filter((f) => f.voice === "masculine");

  if (feminine.length > 0 || masculine.length > 0) {
    const voiceFiles: AudioFileEntry[] = [...feminine, ...masculine];
    groups.push({ id: "voices", label: "Voices", files: voiceFiles });
  }

  // Any remaining ungrouped
  const grouped = new Set(groups.flatMap((g) => g.files));
  const remaining = files.filter((f) => !grouped.has(f));
  if (remaining.length > 0) {
    groups.push({ id: "other", label: "Other", files: remaining });
  }

  return groups;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function MusicReader({
  audioFiles,
  songTitle,
}: {
  audioFiles: AudioFileEntry[];
  songTitle?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { languageLabel } = useTranslation();
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);

  const currentFile = current ? audioFiles.find((f) => f.path === current) : null;

  // Group by language first, then use the first language with files
  const byLang: Record<string, AudioFileEntry[]> = {};
  for (const f of audioFiles) {
    if (!byLang[f.lang]) byLang[f.lang] = [];
    byLang[f.lang].push(f);
  }

  const langs = Object.keys(byLang).sort();
  const [userLang, setUserLang] = useState<string>("");
  const activeLang = langs.length > 0 && langs.includes(userLang) ? userLang : (langs[0] || "");

  const visibleFiles = activeLang ? byLang[activeLang] || [] : [];
  const groups = groupTracks(visibleFiles);

  // Update duration when metadata loads
  const handleMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  }, []);

  // Update current time
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  // When track ends
  const handleEnded = useCallback(() => {
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  const playTrack = useCallback(
    (path: string) => {
      if (!audioRef.current) return;
      if (current === path && playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        setCurrent(path);
        audioRef.current.src = path;
        audioRef.current.volume = volume;
        audioRef.current.play();
        setPlaying(true);
      }
    },
    [current, playing, volume],
  );

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  const handleVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  }, []);

  // Keyboard shortcut: Space to toggle play/pause
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " && current) {
        e.preventDefault();
        playTrack(current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, playTrack]);

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      {/* Player bar */}
      {current && (
        <div className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span className="truncate font-medium text-neutral-700 dark:text-neutral-300 max-w-[60%]">
              {currentFile ? trackLabel(currentFile) : ""}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => playTrack(current)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 transition-opacity"
                title={playing ? "Pause (Space)" : "Play (Space)"}
              >
                {playing ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <rect x="2" y="1" width="3" height="10" rx="0.5" />
                    <rect x="7" y="1" width="3" height="10" rx="0.5" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <polygon points="2,1 11,6 2,11" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-24 h-1.5 accent-neutral-700 dark:accent-neutral-300 cursor-pointer"
                aria-label="Seek"
              />
              <span className="tabular-nums w-16 text-right">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <div className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1.5 5v2M3.5 3.5v5M5.5 2v8M7.5 3.5v5M9.5 5v2" />
                </svg>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={handleVolume}
                  className="w-14 h-1 accent-neutral-700 dark:accent-neutral-300 cursor-pointer"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
          {/* Progress bar (full width) */}
          <div className="relative h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full">
            <div
              className="absolute top-0 left-0 h-full bg-neutral-600 dark:bg-neutral-400 rounded-full transition-all duration-100"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
            />
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        className="hidden"
        onLoadedMetadata={handleMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      <div className="p-4 space-y-4">
        {/* Song title + language selector */}
        <div className="flex items-center justify-between">
          {songTitle && (
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {songTitle}
            </h3>
          )}
          {langs.length > 1 && (
            <div className="flex gap-1">
              {langs.map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    setUserLang(l);
                    if (audioRef.current) {
                      audioRef.current.pause();
                    }
                    setPlaying(false);
                    setCurrent(null);
                    setCurrentTime(0);
                    setDuration(0);
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                    activeLang === l
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  }`}
                >
                  {languageLabel(l)}
                  {l === "es" && (
                    <span className="ml-0.5 opacity-60">*</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Track groups */}
        {groups.map((group) => (
          <div key={group.id}>
            <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.files.map((file) => {
                const isActive = current === file.path;
                const label = trackLabel(file);

                // Determine a sub-label from the voice
                let voiceTag = "";
                if (file.voice === "feminine") voiceTag = "";
                else if (file.voice === "masculine") voiceTag = "";
                else voiceTag = file.voice;

                // Try to detect alto/bajo from filename for a more specific label
                const lowerLabel = label.toLowerCase();
                const hasAlto = lowerLabel.includes("alta");
                const hasBajo = lowerLabel.includes("baja");
                let specificVoice = "";
                if (hasAlto) specificVoice = "Alto";
                else if (hasBajo) specificVoice = "Bajo";

                return (
                  <button
                    key={file.path}
                    onClick={() => playTrack(file.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                      isActive
                        ? playing
                          ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    {/* Play icon */}
                    <span className="w-5 h-5 flex items-center justify-center shrink-0">
                      {isActive && playing ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                          <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
                          <rect x="6" y="1" width="2.5" height="8" rx="0.5" />
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                          <polygon points="1.5,1 8.5,5 1.5,9" />
                        </svg>
                      )}
                    </span>

                    {/* Track label */}
                    <span className="flex-1 truncate">{label}</span>

                    {/* Voice tag */}
                    {(specificVoice || voiceTag) && specificVoice !== label && (
                      <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                        specificVoice === "Alto"
                          ? "bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400"
                          : specificVoice === "Bajo"
                          ? "bg-purple-50 dark:bg-purple-950 text-purple-500 dark:text-purple-400"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                      }`}>
                        {specificVoice || voiceTag}
                      </span>
                    )}

                    {/* Duration placeholder */}
                    {isActive && (
                      <span className="tabular-nums text-neutral-400 text-[10px]">
                        {formatTime(currentTime)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <p className="text-xs text-neutral-400 text-center py-4">
            No audio tracks available for this language.
          </p>
        )}
      </div>
    </div>
  );
}
