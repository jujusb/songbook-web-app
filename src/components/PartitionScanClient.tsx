'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  scanPartitionsAction,
  applyPartitionsAction,
  applyAllPartitionsAction,
} from '@/app/actions';
import type { PartitionMatch } from '@/app/actions';
import { partitionInstrumentOf } from '@/lib/partition-utils';

export function PartitionScanClient() {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [matches, setMatches] = useState<PartitionMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<string[]>([]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const result = await scanPartitionsAction();
      if (result.ok) {
        setMatches(result.matches);
      } else {
        setMatches([]);
        setError(result.error ?? 'FAILED');
      }
    } catch {
      setMatches([]);
      setError('FAILED');
    } finally {
      setScanning(false);
    }
  };

  const handleApply = async (match: PartitionMatch) => {
    setApplying(match.songId);
    try {
      await applyPartitionsAction(match.songId, match.partitions);
      setApplied((prev) => [...prev, match.songId]);
    } finally {
      setApplying(null);
    }
  };

  const handleApplyAll = async () => {
    if (!matches) return;
    setApplying('all');
    try {
      const result = await applyAllPartitionsAction(
        matches.map(({ songId, partitions }) => ({ songId, partitions })),
      );
      if (result.ok) setApplied(matches.map((m) => m.songId));
    } finally {
      setApplying(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {scanning ? t('partitions.scanning') : t('partitions.scan')}
        </button>
        {matches !== null && matches.length > 0 && (
          <button
            onClick={handleApplyAll}
            disabled={applying !== null}
            className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {applying === 'all'
              ? t('partitions.applying')
              : t('partitions.applyAll')}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {matches !== null && (
        <div className="mt-6">
          {matches.length === 0 ? (
            <p className="text-neutral-500 text-sm">
              {t('partitions.none')}
            </p>
          ) : (
            <div>
              <p className="text-sm text-neutral-500 mb-4">
                {t('partitions.found', { n: matches.length })}
              </p>
              <div className="space-y-3">
                {matches.map((match) => {
                  const done = applied.includes(match.songId);
                  return (
                    <div
                      key={match.songId}
                      className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold">{match.title}</div>
                          <code className="text-xs text-neutral-500">
                            {match.songId}
                          </code>
                        </div>
                        <button
                          onClick={() => handleApply(match)}
                          disabled={applying === match.songId || done}
                          className="text-sm px-3 py-1.5 rounded-md font-medium shrink-0 disabled:opacity-50 transition-opacity border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          {done
                            ? t('partitions.applied')
                            : applying === match.songId
                              ? t('partitions.applying')
                              : t('partitions.apply')}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {match.partitions.map((part) => {
                          const parsed = partitionInstrumentOf(part);
                          const showParsed =
                            parsed.label !==
                            (part.instrumentLabel ?? part.instrument);
                          return (
                            <span
                              key={`${part.instrument}::${part.file}`}
                              className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400"
                            >
                              <span className="font-medium">
                                {part.instrumentLabel ?? part.instrument}
                              </span>
                              {showParsed && (
                                <>
                                  <span className="text-neutral-400">
                                    {' '}
                                    &middot;{' '}
                                  </span>
                                  <span className="font-medium">
                                    {parsed.label}
                                  </span>
                                </>
                              )}
                              <span className="text-neutral-400">
                                {' '}
                                &middot;{' '}
                              </span>
                              {part.title}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}