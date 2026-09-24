'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import {
  setSetlistPublicAction,
  createSetlistShareAction,
  deleteSetlistShareAction,
  setSetlistShareSlugAction,
} from '@/app/actions';

/**
 * Visibility and sharing controls for a setlist. Editors can toggle whether
 * the setlist is public (private by default), manage a share token, and give
 * the share link a custom slug. The link points at the read-only instance
 * (`publicUrl`) and uses `/setlists/share/<slug|token>` so it never reveals
 * the setlist's internal id.
 */
export function SetlistShareControls({
  setlistId,
  isPublic,
  shareToken,
  shareSlug,
  publicUrl,
}: {
  setlistId: string;
  isPublic: boolean;
  shareToken?: string;
  shareSlug?: string;
  publicUrl?: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState(shareSlug ?? '');

  const shareBase =
    publicUrl?.trim() ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  const shareIdent = shareSlug || shareToken;
  const shareUrl =
    shareIdent && shareBase
      ? `${shareBase}/setlists/share/${encodeURIComponent(shareIdent)}`
      : null;

  const run = async (
    key: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? 'FAILED');
      }
      return res.ok;
    } catch {
      setError('FAILED');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveSlug = async () => {
    const value = (slugInput ?? '').trim();
    if (value === (shareSlug ?? '')) return;
    if (await run('slug', () => setSetlistShareSlugAction(setlistId, value))) {
      router.refresh();
      setSlugInput(value);
    }
  };

  const clearSlug = async () => {
    setSlugInput('');
    if (await run('slug', () => setSetlistShareSlugAction(setlistId, ''))) {
      router.refresh();
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the link stays visible/selectable
    }
  };

  return (
    <div className="mb-6 rounded-md border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {t('setlist.sharing')}
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {shareToken
              ? t('setlist.shareLinkHint')
              : isPublic
                ? t('setlist.publicHint')
                : t('setlist.privateHint')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => {
              if (await run('public', () => setSetlistPublicAction(setlistId, !isPublic)))
                router.refresh();
            }}
            disabled={busy !== null}
            className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {isPublic ? t('setlist.makePrivate') : t('setlist.makePublic')}
          </button>
          {shareToken ? (
            <button
              onClick={async () => {
                if (await run('remove', () => deleteSetlistShareAction(setlistId)))
                  router.refresh();
              }}
              disabled={busy !== null}
              className="text-sm px-3 py-1.5 border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
            >
              {busy === 'remove'
                ? t('setlist.removingShareLink')
                : t('setlist.removeShareLink')}
            </button>
          ) : (
            <button
              onClick={async () => {
                if (await run('create', () => createSetlistShareAction(setlistId)))
                  router.refresh();
              }}
              disabled={busy !== null}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {busy === 'create'
                ? t('setlist.creatingShareLink')
                : t('setlist.createShareLink')}
            </button>
          )}
        </div>
      </div>

      {shareUrl && (
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 text-xs px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400"
          />
          <button
            onClick={copyLink}
            className="text-sm px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {copied ? t('setlist.copied') : t('setlist.copy')}
          </button>
        </div>
      )}

      {shareToken && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">{t('setlist.customSlug')}</span>
          <input
            value={slugInput}
            onChange={(e) => {
              setSlugInput(e.target.value);
              setError(null);
            }}
            placeholder={t('setlist.slugPlaceholder')}
            disabled={busy !== null}
            className="text-sm px-3 py-1.5 w-56 rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 disabled:opacity-50"
          />
          <button
            onClick={saveSlug}
            disabled={busy !== null}
            className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {t('setlist.saveSlug')}
          </button>
          {shareSlug && (
            <button
              onClick={clearSlug}
              disabled={busy !== null}
              className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {t('setlist.removeSlug')}
            </button>
          )}
        </div>
      )}

      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error === 'SLUG_TAKEN'
            ? t('setlist.slugTaken')
            : error === 'INVALID_SLUG'
              ? t('setlist.slugInvalid')
              : t('setlist.actionFailed')}
        </p>
      ) : null}
    </div>
  );
}