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
    `px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
      isActive
        ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black'
        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400'
    }`;

  return (
    <div className="mb-6 rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
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
          >
            {group.label}
          </button>
        ))}
      </div>

      {showSubTabs && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
            {t('partitions.instrument')}
          </span>
          {current.subs.map((sub, index) => (
            <button
              key={sub.slug}
              type="button"
              onClick={() => setActiveSub(index)}
              className={tabClass(index === current.subs.indexOf(currentSub))}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3">
        {preview && (
          <a
            href={pdfUrl(preview.file)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('partitions.openInNewTab')}
          </a>
        )}
        {partsList.length > 1 && (
          <ul className="mt-1.5 space-y-1">
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
          <iframe
            src={pdfUrl(preview.file)}
            title={preview.title}
            className="mt-2 h-[80vh] w-full rounded border border-neutral-200 dark:border-neutral-800 bg-white"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}