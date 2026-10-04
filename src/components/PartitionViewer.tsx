'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import type { Partition } from '@/lib/content/schemas';
import { partitionInstrumentOf } from '@/lib/partition-utils';

function pdfUrl(file: string): string {
  return `/api/partitions/${file.split('/').map(encodeURIComponent).join('/')}`;
}

interface SubGroup {
  slug: string;
  label: string;
  parts: Partition[];
}

interface FolderGroup {
  instrument: string;
  label: string;
  subs: SubGroup[];
}

function buildGroups(partitions: Partition[]): FolderGroup[] {
  const groups: FolderGroup[] = [];
  for (const part of partitions) {
    const folderKey = part.instrument;
    let folder = groups.find((g) => g.instrument === folderKey);
    if (!folder) {
      folder = {
        instrument: folderKey,
        label: part.instrumentLabel ?? part.instrument,
        subs: [],
      };
      groups.push(folder);
    }
    const sub = partitionInstrumentOf(part);
    let subGroup = folder.subs.find((s) => s.slug === sub.slug);
    if (!subGroup) {
      subGroup = { slug: sub.slug, label: sub.label, parts: [] };
      folder.subs.push(subGroup);
    }
    subGroup.parts.push(part);
  }
  return groups;
}

/**
 * Displays the sheet-music PDFs attached to a song under a single
 * "Instrumental" panel, with tabs per instrument folder and, when a folder
 * holds several parts, sub-tabs per parsed instrument (text after the last
 * ` - ` in the filename). Renders nothing when the song has no partitions.
 */
export function PartitionViewer({ partitions }: { partitions: Partition[] }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [activeSub, setActiveSub] = useState(0);

  if (!partitions || partitions.length === 0) return null;

  const groups = buildGroups(partitions);
  const current = groups[Math.min(active, groups.length - 1)];
  if (!current) return null;

  const showSubTabs = current.subs.length > 1;
  const currentSub = current.subs[Math.min(activeSub, current.subs.length - 1)];
  if (!currentSub) return null;
  const preview = currentSub.parts[0];
  const partsList = showSubTabs
    ? currentSub.parts
    : current.subs.flatMap((s) => s.parts);

  const tabClass = (isActive: boolean) =>
    `px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors min-h-[44px] touch-manipulation whitespace-nowrap ${
      isActive
        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black'
        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400'
    }`;

  return (
    <div className="mb-6 rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
      {/* Main tabs - horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-3 px-3 pb-2 mb-3">
        <div className="flex flex-wrap items-center gap-1 min-w-max">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-neutral-500 shrink-0">
            {t('partitions.title')}
          </span>
          {groups.map((group, index) => (
            <button
              key={group.instrument}
              type="button"
              onClick={() => {
                setActive(index);
                setActiveSub(0);
              }}
              className={tabClass(index === groups.indexOf(current))}
              aria-pressed={index === groups.indexOf(current)}
            >
              {group.label}
            </button>
          ))}
        </div>
      </div>

      {showSubTabs && (
        <div className="overflow-x-auto -mx-3 px-3 pb-2 mb-3">
          <div className="flex flex-wrap items-center gap-1 min-w-max">
            <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400 shrink-0">
              {t('partitions.instrument')}
            </span>
            {current.subs.map((sub, index) => (
              <button
                key={sub.slug}
                type="button"
                onClick={() => setActiveSub(index)}
                className={tabClass(index === current.subs.indexOf(currentSub))}
                aria-pressed={index === current.subs.indexOf(currentSub)}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {preview && (
          <a
            href={pdfUrl(preview.file)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 touch-manipulation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {t('partitions.openInNewTab')}
          </a>
        )}
        {partsList.length > 1 && (
          <ul className="space-y-1">
            {partsList.map((part) => (
              <li key={part.file} className="text-xs text-neutral-600 dark:text-neutral-400">
                <a
                  href={pdfUrl(part.file)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                >
                  {part.title}
                </a>
              </li>
            ))}
          </ul>
        )}
        {preview && (
          <div className="relative aspect-[4/3] sm:aspect-[3/4] w-full rounded border border-neutral-200 dark:border-neutral-800 bg-white overflow-hidden">
            <iframe
              src={pdfUrl(preview.file)}
              title={preview.title}
              className="absolute inset-0 w-full h-full border-0"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}
