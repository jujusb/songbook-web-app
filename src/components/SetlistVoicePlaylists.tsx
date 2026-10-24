'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { generateSetlistVoiceSharesAction } from '@/app/actions';
import type { VoiceShareWithTracks } from '@/app/actions';
import type { VoiceGender, VoiceSection } from '@/lib/navidrome/voices';
import { SongAudioEmbed } from '@/components/SongAudioEmbed';

const SECTION_GENDER: Record<VoiceSection, VoiceGender> = {
  tenor: 'Boy',
  bass: 'Boy',
  alto: 'Girl',
  soprano: 'Girl',
};

const GENDER_SECTIONS: Record<VoiceGender, VoiceSection[]> = {
  Boy: ['tenor', 'bass'],
  Girl: ['alto', 'soprano'],
};

export const SECTION_ORDER: VoiceSection[] = ['tenor', 'bass', 'alto', 'soprano'];

interface SetlistSongForAudio {
  songId: string;
  lang: string;
  title: string;
  spotify?: string;
  youtube?: string;
  originalLang?: string;
  preferredVoice?: VoiceSection;
}

export function SetlistVoicePlaylists({
  setlistId,
  shares,
  canGenerate,
  songs,
  preferredVoice,
}: {
  setlistId: string;
  shares: VoiceShareWithTracks[];
  canGenerate: boolean;
  songs: SetlistSongForAudio[];
  preferredVoice?: VoiceSection;
}) {
  const { t } = useTranslation();
  const genderLabel = (gender: VoiceGender) =>
    gender === 'Boy' ? t('voice.boys') : t('voice.girls');
  const sectionLabel = (section: VoiceSection) => t(`voice.sections.${section}`);
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allTabLoaded, setAllTabLoaded] = useState(false);

  const available = shares.filter((share) => share.tracks.length > 0);

  // Internal state - always uncontrolled, use preferredVoice only for initial selection
  const getInitialShare = () => available[0];
  const [activeGender, setActiveGender] = useState<VoiceGender>(() => {
    const initial = getInitialShare();
    if (initial) return SECTION_GENDER[initial.section];
    // If preferredVoice is set and has content, use its gender
    if (preferredVoice) {
      const prefShare = available.find(s => s.section === preferredVoice);
      if (prefShare) return SECTION_GENDER[prefShare.section];
    }
    return 'Boy';
  });
  const [activeSection, setActiveSection] = useState<VoiceSection>(() => {
    // Use preferredVoice if it has content, otherwise first available section
    if (preferredVoice) {
      const prefShare = available.find(s => s.section === preferredVoice);
      if (prefShare) return preferredVoice;
    }
    const initial = getInitialShare();
    return initial?.section ?? 'tenor';
  });
  const [activeTab, setActiveTab] = useState<'ALL' | VoiceSection>(() => {
    // Use preferredVoice if it has content, otherwise start with ALL
    if (preferredVoice) {
      const prefShare = available.find(s => s.section === preferredVoice);
      if (prefShare) return preferredVoice;
    }
    return 'ALL';
  });

  const currentActiveSection = activeSection;
  const currentActiveGender = SECTION_GENDER[currentActiveSection];
  const currentActiveTab = activeTab;

  const activeShare =
    available.find((share) => share.section === currentActiveSection) ??
    available.find((share) => SECTION_GENDER[share.section] === currentActiveGender) ??
    available[0];

  const visible = available.length > 0;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateSetlistVoiceSharesAction(setlistId);
      if (!result.ok) {
        setError(result.error ?? 'FAILED');
      } else {
        setDone(true);
        router.refresh();
      }
    } catch {
      setError('FAILED');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenderChange = (gender: VoiceGender) => {
    setActiveGender(gender);
    const first = available.find((share) => SECTION_GENDER[share.section] === gender);
    if (first) {
      setActiveSection(first.section);
      setActiveTab(first.section);
    }
  };

  const handleSectionChange = (section: VoiceSection) => {
    setActiveSection(section);
    setActiveTab(section);
  };

  const handleTabChange = (tab: 'ALL' | VoiceSection) => {
    setActiveTab(tab);
    if (tab !== 'ALL') {
      setActiveSection(tab);
      setActiveGender(SECTION_GENDER[tab]);
    }
    if (tab === 'ALL') {
      setAllTabLoaded(true);
    }
  };

  if (!visible) {
    if (!canGenerate) return null;
    return (
      <div className="mb-6 rounded-md border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {t('setlist.voicePlaylists')}
          </span>
          <button
            onClick={handleGenerate}
            disabled={generating || done}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {generating
              ? t('setlist.generatingVoices')
              : done
                ? t('setlist.generated')
                : t('setlist.generateVoices')}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {t('setlist.generateFailed')}
          </p>
        )}
      </div>
    );
  }

  const sectionGroups: VoiceSection[] = GENDER_SECTIONS[currentActiveGender].filter(
    (section) => available.some((share) => share.section === section),
  );
  const tabClass = (active: boolean) =>
    `px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
      active
        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black'
        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400'
    }`;

  // Build navidrome share URL map for ALL tab
  const navidromeShareBySection = new Map(available.map(s => [s.section, s.url]));

  return (
    <div className="mb-6 rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="flex flex-wrap items-center gap-1 mb-3">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          {t('setlist.voicePlaylists')}
        </span>
        
        {/* ALL tab */}
        <button
          type="button"
          onClick={() => handleTabChange('ALL')}
          className={tabClass(currentActiveTab === 'ALL')}
        >
          {t('setlist.all')}
        </button>

        {/* Gender tabs */}
        {(['Boy', 'Girl'] as VoiceGender[]).map((gender) => {
          const hasSections = available.some(
            (share) => SECTION_GENDER[share.section] === gender,
          );
          if (!hasSections) return null;
          return (
            <button
              key={gender}
              type="button"
              onClick={() => handleGenderChange(gender)}
              className={tabClass(currentActiveTab !== 'ALL' && currentActiveGender === gender)}
            >
              {genderLabel(gender)}
            </button>
          );
        })}
        {sectionGroups.length > 1 && (
          <span className="mx-1 text-neutral-300 dark:text-neutral-700">|</span>
        )}
        {/* Section tabs */}
        {sectionGroups.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => handleTabChange(section)}
            className={tabClass(currentActiveTab === section)}
          >
            {sectionLabel(section)}
          </button>
        ))}
      </div>

      {/* ALL tab content */}
      {currentActiveTab === 'ALL' && (
        <div className="space-y-3">
          {songs.map((song) => {
            const isOriginalLang = song.originalLang === song.lang;
            
            // For ALL tab: only show audio for original language (Spotify/YouTube)
            // For translated languages, don't show Navidrome here
            if (!isOriginalLang) {
              return (
                <div key={song.songId} className="flex items-center gap-3 p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 w-40 truncate">
                    {song.title}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {t('voice.translatedLanguage')}
                  </span>
                </div>
              );
            }
            
            return (
              <div key={song.songId} className="flex items-center gap-3 p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 w-40 truncate">
                  {song.title}
                </span>
                <SongAudioEmbed
                  songId={song.songId}
                  lang={song.lang}
                  title={song.title}
                  spotify={song.spotify}
                  youtube={song.youtube}
                  isOriginalLang={true}
                  lazyLoad={!allTabLoaded}
                  navidromeShareUrl={undefined}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Section tab content - Navidrome iframe only */}
      {currentActiveTab !== 'ALL' && (
        <div className="mt-3">
          {activeShare ? (
            <div>
              <span className="text-xs text-neutral-500">
                {t('setlist.tracks', { n: activeShare.count })}
              </span>
              <iframe
                src={activeShare.url}
                title={sectionLabel(activeShare.section)}
                className="w-full h-[80vh] mt-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white"
              />
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-neutral-400">
              {t('voice.noRecordings')}
            </div>
          )}
        </div>
      )}

      {canGenerate && !generating && !done && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="mt-3 text-xs px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {generating
            ? t('setlist.generatingVoices')
            : t('setlist.generateVoices')}
        </button>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {t('setlist.generateFailed')}
        </p>
      )}
    </div>
  );
}