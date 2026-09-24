'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';

interface ShareData {
  url: string;
  songTitle?: string;
  albumTitle?: string;
  artist?: string;
  streamUrl?: string;
  coverArtUrl?: string;
  songs?: { id: string; title: string; streamUrl: string }[];
}

export function NavidromeShareButton({
  type,
  id,
  lang,
  variant = 'full',
}: {
  type: 'song' | 'album';
  id: string;
  lang: string;
  variant?: 'full' | 'compact';
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const [data, setData] = useState<ShareData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/navidrome/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id, lang }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setState('error');
          return;
        }
        setData(json.data);
        setState('done');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, id, lang]);

  if (variant === 'compact') {
    if (state === 'done' && data) {
      if (!data.streamUrl) {
        return (
          <span className="text-xs text-neutral-400">
            {t("share.unavailable")}
          </span>
        );
      }
      return (
        <audio
          controls
          src={data.streamUrl}
          className="h-8 w-48 max-w-full"
        />
      );
    }
    if (state === 'error') {
      return <span className="text-xs text-neutral-400">{t("share.unavailable")}</span>;
    }
    return (
      <div className="h-8 w-48 max-w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
    );
  }

  if (state === 'done' && data) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2">
        {data.coverArtUrl && (
          <img
            src={data.coverArtUrl}
            alt={data.albumTitle ?? "cover"}
            className="h-16 w-16 shrink-0 rounded object-cover"
          />
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          {(data.albumTitle || data.songTitle) && (
            <span className="text-xs text-neutral-500 truncate">
              {[data.artist, data.albumTitle, data.songTitle]
                .filter(Boolean)
                .join(" — ")}
            </span>
          )}
          {data.streamUrl && (
            <audio
              controls
              src={data.streamUrl}
              className="h-9 w-64 max-w-full"
            />
          )}
          {data.songs && data.songs.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">
                {t("share.tracks", { n: data.songs.length })}
              </summary>
              <ul className="mt-1.5 space-y-1.5">
                {data.songs.map((song) => (
                  <li key={song.id} className="flex flex-col gap-0.5">
                    <span className="truncate text-neutral-600 dark:text-neutral-400">
                      {song.title}
                    </span>
                    <audio
                      controls
                      src={song.streamUrl}
                      className="h-8 w-64 max-w-full"
                    />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <span className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm text-neutral-400">
        {t("share.unavailable")}
      </span>
    );
  }

  return (
    <span className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm text-neutral-400 animate-pulse">
      {t("share.generating")}
    </span>
  );
}