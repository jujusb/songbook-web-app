"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";

export interface AudioFileEntry {
  lang: string;
  voice: string;
  path: string;
}

const VOICE_LABELS: Record<string, string> = {
  "masculine-alto": "Masculine Alto",
  "masculine-bajo": "Masculine Bajo",
  "feminine-alto": "Feminine Alto",
  "feminine-bajo": "Feminine Bajo",
};

export function AudioPlayer({
  audioFiles,
  lang,
}: {
  audioFiles: AudioFileEntry[];
  lang?: string;
}) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // Group by language, then by voice
  const byLang: Record<string, AudioFileEntry[]> = {};
  for (const file of audioFiles) {
    if (!byLang[file.lang]) byLang[file.lang] = [];
    byLang[file.lang].push(file);
  }

  const langs = Object.keys(byLang).sort();
  const activeLang = lang && byLang[lang] ? lang : langs[0] || null;

  const handlePlay = useCallback((path: string) => {
    if (audioRef.current) {
      if (current === path) {
        audioRef.current.play();
        setPlaying(true);
      } else {
        setCurrent(path);
        audioRef.current.src = path;
        audioRef.current.play();
        setPlaying(true);
      }
    }
  }, [current]);

  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaying(false);
  }, []);

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 space-y-3">
      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        {t("audio.parts")}
      </div>

      <audio ref={audioRef} className="hidden" />

      {langs.map((l) => (
        <div key={l}>
          <div className="text-xs font-medium text-neutral-500 mb-1 uppercase tracking-wider">
            {l}
            {l === "es" && (
              <span className="text-amber-500 ml-1 text-[10px]">
                ({t("audio.original")})
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {byLang[l].map((file) => {
              const isActive = current === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => (isActive && playing ? handleStop() : handlePlay(file.path))}
                  className={`text-xs px-2 py-1.5 rounded border transition-colors text-left ${
                    isActive && playing
                      ? "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                      : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  <div className="font-medium">{VOICE_LABELS[file.voice] || file.voice}</div>
                  {isActive && (
                    <div className="text-[10px] mt-0.5 opacity-60">
                      {playing ? t("audio.playing") + "..." : t("audio.paused")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {langs.length === 0 && (
        <p className="text-xs text-neutral-400">{t("audio.noAudio")}</p>
      )}
    </div>
  );
}
