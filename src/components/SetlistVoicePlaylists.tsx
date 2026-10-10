'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { generateSetlistVoiceSharesAction } from '@/app/actions';
import type { VoiceShareWithTracks } from '@/app/actions';
import type { VoiceGender, VoiceSection } from '@/lib/navidrome/voices';

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

/**
 * Per-voice shared playlists for a setlist, one Navidrome share per section
 * containing that voice's recordings for every song in the list. Mirrors the
 * song-page voices UI (boys / girls tabs): sections render the shared
 * playlist in an iframe when the share page allows embedding, otherwise an
 * "Open playlist" link plus the section's stream players. When no shares
 * exist yet, editors see a button to generate them.
 */
export function SetlistVoicePlaylists({
  setlistId,
  shares,
  canGenerate,
  preferredVoice,
}: {
  setlistId: string;
  shares: VoiceShareWithTracks[];
  canGenerate: boolean;
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

  const available = shares.filter((share) => share.tracks.length > 0);

  const preferredShare = preferredVoice
    ? available.find((share) => share.section === preferredVoice)
    : undefined;
  const initialShare = preferredShare ?? available[0];
  const [activeGender, setActiveGender] = useState<VoiceGender>(
    initialShare ? SECTION_GENDER[initialShare.section] : 'Boy',
  );
  const [activeSection, setActiveSection] = useState<VoiceSection>(
    initialShare?.section ?? 'tenor',
  );

  const activeShare =
    available.find((share) => share.section === activeSection) ??
    available.find((share) => SECTION_GENDER[share.section] === activeGender) ??
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

  const sectionGroups: VoiceSection[] = GENDER_SECTIONS[activeGender].filter(
    (section) => available.some((share) => share.section === section),
  );
  const tabClass = (active: boolean) =>
    `px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
      active
        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black'
        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400'
    }`;

  return (
    <div className="mb-6 rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          {t('setlist.voicePlaylists')}
        </span>
        {(['Boy', 'Girl'] as VoiceGender[]).map((gender) => {
          const hasSections = available.some(
            (share) => SECTION_GENDER[share.section] === gender,
          );
          if (!hasSections) return null;
          return (
            <button
              key={gender}
              type="button"
              onClick={() => {
                setActiveGender(gender);
                const first = available.find(
                  (share) => SECTION_GENDER[share.section] === gender,
                );
                if (first) setActiveSection(first.section);
              }}
              className={tabClass(gender === activeGender)}
            >
              {genderLabel(gender)}
            </button>
          );
        })}
        {sectionGroups.length > 1 && (
          <span className="mx-1 text-neutral-300 dark:text-neutral-700">|</span>
        )}
        {sectionGroups.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setActiveSection(section)}
            className={tabClass(section === activeShare?.section)}
          >
            {sectionLabel(section)}
          </button>
        ))}
      </div>

      {activeShare && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={activeShare.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('setlist.openPlaylist')}
            </a>
            <span className="text-xs text-neutral-500">
              {t('setlist.tracks', { n: activeShare.count })}
            </span>
          </div>

          {activeShare.embeddable ? (
            <iframe
              src={activeShare.url}
              title={activeShare.section}
              className="mt-3 h-[80vh] w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white"
            />
          ) : (
            <div className="mt-3 flex flex-wrap gap-3">
              {activeShare.tracks.map((part) => (
                <div
                  key={part.streamUrl}
                  className="flex flex-col gap-1 min-w-0 flex-1 basis-44"
                >
                  <div className="flex items-start gap-2">
                    {part.coverArtUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={part.coverArtUrl}
                        alt={part.title}
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    )}
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">
                      {part.title}
                    </span>
                  </div>
                  <audio
                    controls
                    src={part.streamUrl}
                    className="h-8 w-full max-w-full"
                  />
                </div>
              ))}
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