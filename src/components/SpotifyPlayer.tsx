'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { spotifySearchUrl } from '@/lib/spotify';

function spotifyIdFromUrl(url: string, type: 'track' | 'album'): string | null {
  const pattern = type === 'track' ? /\/track\/([A-Za-z0-9]+)/ : /\/album\/([A-Za-z0-9]+)/;
  return url.match(pattern)?.[1] ?? null;
}

export function SpotifyPlayer({
  type: itemType,
  id,
  lang,
  explicitUrl = null,
  title,
  artist,
  variant = 'full',
}: {
  type: 'track' | 'album';
  id: string;
  lang: string;
  explicitUrl?: string | null;
  title: string;
  artist?: string;
  variant?: 'full' | 'compact';
}) {
  const { t } = useTranslation();
  const [fetched, setFetched] = useState<{ itemId: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const height = itemType === "track" ? 80 : 152;

  const explicitId = explicitUrl ? spotifyIdFromUrl(explicitUrl, itemType) : null;

  useEffect(() => {
    if (explicitId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/spotify/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: itemType, id, lang }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.ok || !json.data) {
          setFailed(true);
          return;
        }
        setFetched({ itemId: json.data.id });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemType, id, lang, explicitId]);

  const playerId = explicitId ?? fetched?.itemId ?? null;

  const fallbackLink = (className: string) => (
    <a
      href={spotifySearchUrl([artist, title].filter(Boolean).join(" "), itemType === "track" ? "tracks" : "albums")}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {t("spotify.search")}
    </a>
  );

  if (playerId) {
    return (
      <iframe
        src={`https://open.spotify.com/embed/${itemType}/${playerId}`}
        width="100%"
        height={height}
        frameBorder="0"
        allow="encrypted-media"
        loading="lazy"
        title={title}
        className={variant === "compact" ? "w-64 max-w-full" : "max-w-full"}
      />
    );
  }

  if (failed) {
    return variant === "compact"
      ? fallbackLink(
          "shrink-0 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
        )
      : fallbackLink(
          "px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
        );
  }

  return (
    <div
      className={variant === "compact" ? "w-64 max-w-full" : "max-w-full"}
      style={{ height }}
    >
      <div className="h-full w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}