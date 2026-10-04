'use client';

import { useState, useEffect } from 'react';
import type {
  VoiceGender,
  VoiceSection,
  VoiceGroup,
} from '@/lib/navidrome/voices';

const GENDER_LABELS: Record<VoiceGender, string> = {
  boys: 'Chicos',
  girls: 'Chicas',
};

/**
 * Renders the VOICES Navidrome players for a song. Tabs split by Chicos
 * (TENOR / BASS) and Chicas (ALTO / SOPRANO). Fetches automatically on mount;
 * hidden when no voice parts exist.
 */
export function VoiceSections({ id, lang }: { id: string; lang: string }) {
  const [groups, setGroups] = useState<VoiceGroup[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeGender, setActiveGender] = useState<VoiceGender>('boys');
  const [activeSection, setActiveSection] = useState<VoiceSection>('tenor');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/voices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, lang }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.ok) {
          const data: VoiceGroup[] = json.data?.groups ?? [];
          const first = data.find((group) =>
            group.sections.some(({ parts }) => parts.length > 0),
          );
          if (first) {
            setActiveGender(first.gender);
            const section = first.sections.find(({ parts }) => parts.length > 0);
            if (section) setActiveSection(section.section);
          }
          setGroups(data);
        }
      } catch {
        // ignore: voices are optional, hide the block on any failure
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  if (!loaded) return null;
  if (!groups || groups.length === 0) return null;

  const available = groups.filter((group) =>
    group.sections.some(({ parts }) => parts.length > 0),
  );
  if (available.length === 0) return null;

  const currentGroup =
    available.find((group) => group.gender === activeGender) ?? available[0];
  const sectionGroups = currentGroup.sections.filter(({ parts }) => parts.length > 0);
  const currentSection =
    sectionGroups.find(({ section }) => section === activeSection) ?? sectionGroups[0];
  const parts = currentSection?.parts ?? [];

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors min-h-[44px] touch-manipulation ${
      active
        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black'
        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400'
    }`;

  return (
    <div className="mb-6 rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="flex flex-wrap items-center gap-1 mb-3">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Voices
        </span>
        {available.map((group) => (
          <button
            key={group.gender}
            type="button"
            onClick={() => {
              setActiveGender(group.gender);
              const section = group.sections.find(({ parts }) => parts.length > 0);
              if (section) setActiveSection(section.section);
            }}
            className={tabClass(group.gender === currentGroup.gender)}
            aria-pressed={group.gender === currentGroup.gender}
          >
            {GENDER_LABELS[group.gender]}
          </button>
        ))}
        {sectionGroups.length > 1 && (
          <span className="mx-1 text-neutral-300 dark:text-neutral-700">|</span>
        )}
        {sectionGroups.map(({ section }) => (
          <button
            key={section}
            type="button"
            onClick={() => setActiveSection(section)}
            className={tabClass(section === currentSection.section)}
            aria-pressed={section === currentSection.section}
          >
            {section}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {parts.map((part) => (
          <div
            key={part.streamUrl}
            className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"
          >
            {part.coverArtUrl && (
              <img
                src={part.coverArtUrl}
                alt={part.title}
                className="h-12 w-12 shrink-0 rounded object-cover sm:h-10 sm:w-10"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block truncate">
                {part.title}
              </span>
              <audio
                controls
                src={part.streamUrl}
                className="w-full mt-1 h-10"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
