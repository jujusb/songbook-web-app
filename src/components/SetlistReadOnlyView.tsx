"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { shouldShowSongInLanguage } from "@/lib/content/client";
import { languageLabelFor } from "@/lib/i18n/labels";
import { SongVoiceSelector } from "@/components/SongVoiceSelector";
import { SetlistVoicePlaylists } from "@/components/SetlistVoicePlaylists";
import { transpose, renderVisualChordSheet } from "@/lib/chordpro";
import {
  updateSetlistLyricsViewAction,
  updateSetlistGlobalOptionsAction,
  updateSetlistTransposeAction,
} from "@/app/actions";
import { useTranslation } from "@/lib/i18n";
import type { VoiceSection, VoiceGroup } from "@/lib/navidrome/voices";

export interface SetlistReadOnlySong {
  songId: string;
  lang: string;
  title: string;
  key?: string;
  translations: string[];
  published?: boolean;
  body?: string;
  spotify?: string;
  youtube?: string;
  originalLang?: string;
}

interface UserPreferences {
  showChords: boolean;
  showRepeats: boolean;
  chordNotation: "letters" | "solfege" | "roman" | "nashville";
  inlineChords: boolean;
  setlistLyricsView: "all" | "list";
  setlistTranspose: Record<string, number>;
}

interface SetlistReadOnlyViewProps {
  songs: SetlistReadOnlySong[];
  selectedLang: string;
  defaultLang: string;
  userPreferences: UserPreferences;
  songBodies: Record<string, string>;
  isReference: boolean;
  sourceSetlistId: string;
  preferredVoice?: VoiceSection;
  voiceShares: { section: VoiceSection; tracks: { title: string; streamUrl: string; coverArtUrl?: string }[]; count: number; embeddable: boolean; url: string }[];
  canGenerate: boolean;
}

const CHORD_NOTATION_OPTIONS = [
  { value: "letters", label: "Letters (A, B, C...)" },
  { value: "solfege", label: "Solfege (Do, Re, Mi...)" },
  { value: "roman", label: "Roman Numerals (I, II, III...)" },
  { value: "nashville", label: "Nashville Numbers (1, 2, 3...)" },
] as const;

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7-7" />
    </svg>
  );
}

function MinusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16M4 12h16" />
    </svg>
  );
}

function SettingsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 00-2.573-1.066c-1.543-.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 002.573-1.066c1.543-.94 3.31-.826 2.37-2.37a1.724 1.724 0 001.065-2.572c1.756-.426 1.756-2.924 0-3.35a1.724 1.724 0 00-1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

export function SetlistReadOnlyView({
  songs,
  selectedLang,
  defaultLang,
  userPreferences,
  songBodies,
  isReference,
  sourceSetlistId,
  preferredVoice,
  voiceShares,
  canGenerate,
}: SetlistReadOnlyViewProps) {
  const { t } = useTranslation();

  const visible = songs.filter((song) =>
    shouldShowSongInLanguage(song.translations, selectedLang, defaultLang) &&
    song.published !== false
  );

  const [displayMode, setDisplayMode] = useState<"all" | "list">(userPreferences.setlistLyricsView);
  const [expandedSongIds, setExpandedSongIds] = useState<Set<string>>(new Set());
  const [transposeMap, setTransposeMap] = useState<Map<string, number>>(
    new Map(Object.entries(userPreferences.setlistTranspose))
  );
  const [globalOptions, setGlobalOptions] = useState({
    showChords: userPreferences.showChords,
    showRepeats: userPreferences.showRepeats,
    chordNotation: userPreferences.chordNotation,
    inlineChords: userPreferences.inlineChords,
  });
  const [showGlobalOptions, setShowGlobalOptions] = useState(false);

  // Voice-related state
  const [activeSection, setActiveSection] = useState<VoiceSection>('tenor');
  const [voiceData, setVoiceData] = useState<Map<string, VoiceGroup[]>>(new Map());
  const [voiceLoading, setVoiceLoading] = useState(true);
  const [voiceInitialized, setVoiceInitialized] = useState(false);

  // Batch fetch voice data for all visible songs
  useEffect(() => {
    let cancelled = false;

    const fetchVoiceData = async () => {
      if (visible.length === 0) {
        setVoiceLoading(false);
        setVoiceInitialized(true);
        return;
      }

      try {
        const res = await fetch('/api/voices/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: visible.map((s) => ({ id: s.songId, lang: s.lang })),
          }),
        });
        const json = await res.json();

        if (cancelled) return;

        if (json.ok && json.data?.results) {
          const map = new Map<string, VoiceGroup[]>();
          for (const { songId, groups } of json.data.results) {
            map.set(songId, groups ?? []);
          }
          setVoiceData(map);
        }
      } catch {
        // Ignore errors, voice data is optional
      } finally {
        if (!cancelled) {
          setVoiceLoading(false);
          setVoiceInitialized(true);
        }
      }
    };

    fetchVoiceData();

    return () => {
      cancelled = true;
    };
  }, [visible, selectedLang, defaultLang]);

  // Initialize activeSection from preferredVoice or first available
  useEffect(() => {
    if (voiceInitialized && !voiceLoading) {
      let initialized = false;

      // Try preferred voice first
      if (preferredVoice) {
        for (const groups of voiceData.values()) {
          const hasContent = groups.some((group) =>
            group.sections.some((s) => s.section === preferredVoice && s.parts.length > 0)
          );
          if (hasContent) {
            setActiveSection(preferredVoice);
            initialized = true;
            break;
          }
        }
      }

      // Fall back to first available section across all songs
      if (!initialized) {
        for (const groups of voiceData.values()) {
          for (const group of groups) {
            const section = group.sections.find((s) => s.parts.length > 0);
            if (section) {
              setActiveSection(section.section);
              initialized = true;
              break;
            }
          }
          if (initialized) break;
        }
      }

      // If still no content, default to tenor
      if (!initialized) {
        setActiveSection('tenor');
      }
    }
  }, [voiceInitialized, voiceLoading, voiceData, preferredVoice]);

  const handleToggleAll = useCallback(async () => {
    const nextMode = displayMode === "all" ? "list" : "all";
    setDisplayMode(nextMode);
    try {
      await updateSetlistLyricsViewAction(nextMode);
    } catch (err) {
      console.error("Failed to update lyrics view preference:", err);
    }
  }, [displayMode]);

  const handleToggleSong = useCallback((songId: string) => {
    setExpandedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  }, []);

  const handleChangeTranspose = useCallback(async (songId: string, delta: number) => {
    const current = transposeMap.get(songId) ?? 0;
    const next = Math.max(-12, Math.min(12, current + delta));
    setTransposeMap((prev) => new Map(prev).set(songId, next));
    try {
      await updateSetlistTransposeAction(sourceSetlistId, songId, next);
    } catch (err) {
      console.error("Failed to update transpose:", err);
    }
  }, [sourceSetlistId, transposeMap]);

  const handleUpdateGlobalOptions = useCallback(async (options: Partial<typeof globalOptions>) => {
    const next = { ...globalOptions, ...options };
    setGlobalOptions(next);
    try {
      await updateSetlistGlobalOptionsAction(next);
    } catch (err) {
      console.error("Failed to update global options:", err);
    }
  }, [globalOptions]);

  // Build combined body map from songBodies and song.body
  const combinedBodyMap = new Map<string, string>();
  for (const song of visible) {
    const body = songBodies[song.songId] || song.body || '';
    if (body.trim()) combinedBodyMap.set(song.songId, body);
  }

  const renderLyrics = useCallback((songId: string) => {
    const body = combinedBodyMap.get(songId) || '';
    if (!body) return null;
    const semitones = transposeMap.get(songId) ?? 0;
    const transposed = semitones !== 0 ? transpose(body, semitones) : body;
    return renderVisualChordSheet(transposed, {
      showChords: globalOptions.showChords,
      repeatChorus: globalOptions.showRepeats,
      inlineChords: globalOptions.inlineChords,
      hideInstrumentals: false,
    });
  }, [combinedBodyMap, transposeMap, globalOptions]);

  const isSongExpanded = (songId: string) => {
    if (displayMode === "all") return true;
    return expandedSongIds.has(songId);
  };

  // Render song list separately to avoid JSX parsing issues
  const songListItems = visible.map((song, index) => {
    const expanded = isSongExpanded(song.songId);
    const semitones = transposeMap.get(song.songId) ?? 0;
    const body = combinedBodyMap.get(song.songId) || '';
    const hasBody = body.trim() !== '';

    return (
      <li key={`${song.songId}-${index}`}>
        {/* Song Row - click to expand/collapse */}
        <button
          onClick={() => hasBody && displayMode === "list" && handleToggleSong(song.songId)}
          className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-left ${!hasBody ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={!hasBody}
          aria-expanded={expanded}
          aria-controls={`lyrics-${song.songId}`}
        >
          <span className="text-sm text-neutral-400 w-8 text-right font-mono">
            {index + 1}
          </span>
          <Link
            href={`/songs/${song.songId}`}
            className="flex-1 font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {song.title}
          </Link>
          {song.key && (
            <span className="text-xs text-neutral-400">{song.key}</span>
          )}
          <span className="text-xs px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-500">
            {languageLabelFor(song.lang)}
          </span>
          {hasBody && displayMode === "list" ? (
            <span className="ml-auto text-neutral-400">
              {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </span>
          ) : null}
          {/* Audio source icons */}
          <div className="flex items-center gap-1 ml-2">
            {(song.spotify || song.youtube) && song.lang === song.originalLang ? (
              <>
                {song.spotify && (
                  <a
                    href={song.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:opacity-80 transition-opacity"
                    title={t('setlist.spotify')}
                  >
                    🎵
                  </a>
                )}
                {song.youtube && (
                  <a
                    href={song.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:opacity-80 transition-opacity"
                    title={t('setlist.youtube')}
                  >
                    ▶
                  </a>
                )}
              </>
            ) : (
              <button
                onClick={() => {
                  const groups = voiceData.get(song.songId);
                  if (groups) {
                    const hasVoice = groups.some((group) =>
                      group.sections.some((s) => s.section === activeSection && s.parts.length > 0)
                    );
                    if (hasVoice) {
                      // Already on a section with voice content
                    } else {
                      // Find first section with content
                      for (const group of groups) {
                        const section = group.sections.find((s) => s.parts.length > 0);
                        if (section) {
                          setActiveSection(section.section);
                          break;
                        }
                      }
                    }
                  }
                }}
                className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded hover:opacity-80 transition-opacity"
                title={t('voice.navidrome')}
              >
                🎤
              </button>
            )}
          </div>
        </button>

        {/* Voice Selector - ALWAYS visible between row and expanded lyrics */}
        {voiceInitialized && (
          <SongVoiceSelector
            songId={song.songId}
            lang={song.lang}
            groups={voiceData.get(song.songId) ?? []}
            preferredVoice={preferredVoice}
            compact
          />
        )}

        {/* Expanded Lyrics */}
        {expanded && hasBody ? (
          <div id={`lyrics-${song.songId}`} className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
            <div className="px-4 py-3 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Transpose Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{t("setlist.transpose")}:</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleChangeTranspose(song.songId, -1); }}
                    className="p-1.5 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    aria-label={t("setlist.transposeDown")}
                    title={t("setlist.transposeDown")}
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-mono w-10 text-center">
                    {semitones > 0 ? `+${semitones}` : semitones}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleChangeTranspose(song.songId, 1); }}
                    className="p-1.5 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    aria-label={t("setlist.transposeUp")}
                    title={t("setlist.transposeUp")}
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                  {semitones !== 0 ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleChangeTranspose(song.songId, -semitones); }}
                      className="text-xs px-2 py-1 text-neutral-500 hover:text-neutral-700"
                    >
                      {t("setlist.transposeReset")}
                    </button>
                  ) : null}
                </div>
                <span className="text-xs text-neutral-400 ml-auto">
                  {semitones !== 0 ? t("setlist.semitones", { count: Math.abs(semitones) }) : ""}
                </span>
              </div>
            </div>
            <div className="px-4 py-3">
              <div
                className={`visual-chord-sheet ${!globalOptions.showChords ? "hide-chords" : ""}`}
                dangerouslySetInnerHTML={{ __html: renderLyrics(song.songId) || "" }}
              />
              {voiceLoading && (
                <div className="text-center py-3">
                  <span className="text-xs text-neutral-400 animate-pulse">
                    {t('voice.loading')}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </li>
    );
  });

  return (
    <>
      {/* Top-level voice playlists - use preferredVoice for initial selection only */}
      <SetlistVoicePlaylists
        setlistId={sourceSetlistId}
        shares={voiceShares}
        canGenerate={canGenerate}
        songs={visible.map((s) => ({
          songId: s.songId,
          lang: s.lang,
          title: s.title,
          spotify: s.spotify,
          youtube: s.youtube,
          originalLang: s.originalLang,
          preferredVoice: preferredVoice,
        }))}
        preferredVoice={preferredVoice}
      />

      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        {/* Header Toolbar */}
        <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Song Order
              </span>
              {isReference ? (
                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                  {t("setlist.savedFromShared")}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {/* Display All / Retract All */}
              <button
                onClick={handleToggleAll}
                className="text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title={displayMode === "all" ? t("setlist.retractAll") : t("setlist.displayAll")}
              >
                {displayMode === "all" ? t("setlist.retractAll") : t("setlist.displayAll")}
              </button>

              {/* Global Options Toggle */}
              <button
                onClick={() => setShowGlobalOptions(!showGlobalOptions)}
                className="p-2 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label={t("setlist.globalOptions")}
                title={t("setlist.globalOptions")}
              >
                <SettingsIcon />
              </button>

              {/* View Original Link */}
              {isReference ? (
                <Link
                  href={`/setlists/${sourceSetlistId}`}
                  className="p-2 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label={t("setlist.viewOriginal")}
                  title={t("setlist.viewOriginal")}
                >
                  <ExternalLinkIcon />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {/* Global Options Panel */}
        {showGlobalOptions ? (
          <div className="px-4 py-3 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={globalOptions.showChords}
                  onChange={(e) => handleUpdateGlobalOptions({ showChords: e.target.checked })}
                  className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{t("setlist.showChords")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={globalOptions.showRepeats}
                  onChange={(e) => handleUpdateGlobalOptions({ showRepeats: e.target.checked })}
                  className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{t("setlist.showRepeats")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={globalOptions.inlineChords}
                  onChange={(e) => handleUpdateGlobalOptions({ inlineChords: e.target.checked })}
                  className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{t("setlist.inlineChords")}</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-500 whitespace-nowrap">{t("setlist.chordNotation")}:</label>
                <select
                  value={globalOptions.chordNotation}
                  onChange={(e) => handleUpdateGlobalOptions({ chordNotation: e.target.value as "letters" | "solfege" | "roman" | "nashville" })}
                  className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded-md text-xs bg-white dark:bg-neutral-900"
                >
                  {CHORD_NOTATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : null}

        {/* Song List */}
        <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {songListItems}
        </ol>
      </div>
    </>
  );
}