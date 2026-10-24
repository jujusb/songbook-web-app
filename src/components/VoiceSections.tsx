'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import type {
  VoiceSection,
  VoicePart,
  VoiceGroup,
} from '@/lib/navidrome/voices';

export const SECTION_ORDER: VoiceSection[] = ['tenor', 'bass', 'alto', 'soprano'];

/**
 * Renders the VOICES Navidrome players for a song as a flat list of all four
 * sections (tenor, bass, alto, soprano). Each section shows its track count
 * and audio players for available recordings, or a muted "no recordings" label
 * when empty. Hidden when no voice parts exist at all.
 */
export function VoiceSections({
  id,
  lang,
  preferredVoice,
}: {
  id: string;
  lang: string;
  preferredVoice?: VoiceSection;
}) {
  const { t } = useTranslation();
  const sectionLabel = (section: VoiceSection) => t(`voice.sections.${section}`);
  const [groups, setGroups] = useState<VoiceGroup[] | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  // Flatten all parts by section
  const partsBySection = new Map<VoiceSection, VoicePart[]>();
  for (const group of groups) {
    for (const { section, parts } of group.sections) {
      const existing = partsBySection.get(section) ?? [];
      partsBySection.set(section, [...existing, ...parts]);
    }
  }

  // Check if any section has content
  const hasAnyContent = [...partsBySection.values()].some((parts) => parts.length > 0);
  if (!hasAnyContent) return null;

  return (
    <div className="mb-6 rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
      <span className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-3">
        Voices
      </span>
      <div className="space-y-4">
        {SECTION_ORDER.map((section) => {
          const parts = partsBySection.get(section) ?? [];
          const isPreferred = section === preferredVoice;
          if (parts.length > 0) {
            return (
              <div key={section} className="space-y-2">
                <span className={`block text-xs font-medium ${isPreferred ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'}`}>
                  {sectionLabel(section)} — {parts.length} track{parts.length !== 1 ? 's' : ''}
                  {isPreferred && <span className="ml-1 text-xs text-blue-500 dark:text-blue-300">★</span>}
                </span>
                <div className="space-y-3">
                  {parts.map((part) => (
                    <div
                      key={part.streamUrl}
                      className="flex items-start gap-3 p-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    >
                      {part.coverArtUrl && (
                        <img
                          src={part.coverArtUrl}
                          alt={part.title}
                          className="h-16 w-16 shrink-0 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block truncate">
                          {part.title}
                        </span>
                        <audio
                          controls
                          src={part.streamUrl}
                          className="w-full mt-2 h-10"
                        />
                      </div>
                    </div>
                  ))}
                </div>
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
    </div>
  );
}