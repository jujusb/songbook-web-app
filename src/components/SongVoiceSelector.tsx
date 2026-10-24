'use client';

import { useTranslation } from '@/lib/i18n';
import type {
  VoiceGender,
  VoiceSection,
  VoicePart,
  VoiceGroup,
} from '@/lib/navidrome/voices';

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

const SECTION_ORDER: VoiceSection[] = ['tenor', 'bass', 'alto', 'soprano'];

interface SongVoiceSelectorProps {
  songId: string;
  lang: string;
  groups: VoiceGroup[];
  activeSection: VoiceSection;
  onSectionChange: (section: VoiceSection) => void;
  compact?: boolean;
}

export function SongVoiceSelector({
  songId,
  lang,
  groups,
  activeSection,
  onSectionChange,
  compact = false,
}: SongVoiceSelectorProps) {
  const { t } = useTranslation();
  const genderLabel = (gender: VoiceGender) =>
    gender === 'Boy' ? t('voice.boys') : t('voice.girls');
  const sectionLabel = (section: VoiceSection) => t(`voice.sections.${section}`);
  const noRecordingsLabel = t('voice.noRecordings');

  // Filter groups that have content
  const available = groups.filter((group) =>
    group.sections.some(({ parts }) => parts.length > 0),
  );

  // Determine current group based on activeSection
  const activeGender = SECTION_GENDER[activeSection];
  const currentGroup =
    available.find((group) => group.gender === activeGender) ??
    available[0];

  // Get sections for current gender that have content
  const sectionGroups = currentGroup?.sections.filter(({ parts }) => parts.length > 0) ?? [];
  const currentSection =
    sectionGroups.find(({ section }) => section === activeSection) ?? sectionGroups[0];

  const parts = currentSection?.parts ?? [];

  const tabClass = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors min-h-[40px] touch-manipulation ${
      active
        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black'
        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400'
    }${compact ? ' px-1.5 py-0.5' : ' px-3 py-1.5'}`;

  const containerClass = `mb-4 rounded-md border border-neutral-200 dark:border-neutral-800 ${compact ? 'p-2' : 'p-3'}`;

  return (
    <div className={containerClass}>
      <div className="flex flex-wrap items-center gap-1 mb-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          {t('voice.voices')}
        </span>
        {available.map((group) => (
          <button
            key={group.gender}
            type="button"
            onClick={() => {
              const first = group.sections.find(({ parts }) => parts.length > 0);
              if (first) onSectionChange(first.section);
            }}
            className={tabClass(group.gender === currentGroup?.gender)}
            aria-pressed={group.gender === currentGroup?.gender}
          >
            {genderLabel(group.gender)}
          </button>
        ))}
        {sectionGroups.length > 1 && (
          <span className="mx-1 text-neutral-300 dark:text-neutral-700">|</span>
        )}
        {sectionGroups.map(({ section }) => (
          <button
            key={section}
            type="button"
            onClick={() => onSectionChange(section)}
            className={tabClass(section === currentSection?.section)}
            aria-pressed={section === currentSection?.section}
          >
            {sectionLabel(section)}
          </button>
        ))}
      </div>

      {parts.length > 0 ? (
        <div className="space-y-2">
          {parts.map((part) => (
            <div
              key={part.streamUrl}
              className="flex items-start gap-2 p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
            >
              {part.coverArtUrl && (
                <img
                  src={part.coverArtUrl}
                  alt={part.title}
                  className="h-10 w-10 shrink-0 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block truncate">
                  {part.title}
                </span>
                <audio
                  controls
                  src={part.streamUrl}
                  className="w-full mt-1 h-8"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-3">
          <span className="text-xs text-neutral-400">
            {noRecordingsLabel}
          </span>
        </div>
      )}
    </div>
  );
}