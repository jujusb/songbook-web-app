'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { generateSetlistVoiceSharesAction } from '@/app/actions';
import type { VoiceShareWithTracks } from '@/app/actions';
import type { VoiceSection } from '@/lib/navidrome/voices';

export const SECTION_ORDER: VoiceSection[] = ['tenor', 'bass', 'alto', 'soprano'];

/**
 * Per-voice shared playlists for a setlist, one Navidrome share per section
 * containing that voice's recordings for every song in the list. Renders a
 * flat list of all four sections (tenor, bass, alto, soprano) with an iframe
 * for sections that have a share, and a muted label for sections without.
 * When no shares exist yet, editors see a button to generate them.
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
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (shares.length === 0) {
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

  const sectionLabel = (section: VoiceSection) => t(`voice.sections.${section}`);

  return (
    <div className="mb-6 rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
      <span className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-3">
        {t('setlist.voicePlaylists')}
      </span>
      <div className="space-y-4">
        {SECTION_ORDER.map((section) => {
          const share = shares.find((s) => s.section === section);
          const isPreferred = section === preferredVoice;
          if (share) {
            return (
              <div key={section} className="space-y-1">
                <span className={`block text-xs font-medium ${isPreferred ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'}`}>
                  {sectionLabel(section)} — {share.count} track{share.count !== 1 ? 's' : ''}
                  {isPreferred && <span className="ml-1 text-xs text-blue-500 dark:text-blue-300">★</span>}
                </span>
                <iframe
                  src={share.url}
                  title={sectionLabel(section)}
                  className="w-full h-[50vh] min-h-[300px] rounded-md border border-neutral-200 dark:border-neutral-800 bg-white"
                />
              </div>
            );
          }
          return (
            <div key={section} className="space-y-1">
              <span className={`block text-xs ${isPreferred ? 'text-blue-400 dark:text-blue-300' : 'text-neutral-400'}`}>
                {sectionLabel(section)} — no recordings
                {isPreferred && <span className="ml-1">★</span>}
              </span>
            </div>
          );
        })}
      </div>
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