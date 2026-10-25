'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/i18n';
import { EmbedFrame } from '@/components/OpenInNewTabButton';

interface SongAudioEmbedProps {
  songId: string;
  lang: string;
  title: string;
  spotify?: string;
  youtube?: string;
  isOriginalLang: boolean;
  lazyLoad: boolean;
  navidromeShareUrl?: string;
}

function extractSpotifyTrackId(url: string): string | null {
  const match = url.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function SongAudioEmbed({
  songId,
  lang,
  title,
  spotify,
  youtube,
  isOriginalLang,
  lazyLoad,
  navidromeShareUrl,
}: SongAudioEmbedProps) {
  const { t } = useTranslation();
  const [shouldLoad, setShouldLoad] = useState(!lazyLoad);
  const iframeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lazyLoad) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    if (iframeRef.current) observer.observe(iframeRef.current);
    return () => observer.disconnect();
  }, [lazyLoad]);

  const spotifyTrackId = spotify ? extractSpotifyTrackId(spotify) : null;
  const youtubeVideoId = youtube ? extractYouTubeVideoId(youtube) : null;
  const spotifyEmbedUrl = spotifyTrackId ? `https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator` : null;
  const youtubeEmbedUrl = youtubeVideoId ? `https://www.youtube.com/embed/${youtubeVideoId}` : null;

  if (!shouldLoad) {
    return (
      <div ref={iframeRef} className="h-20 w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 animate-pulse" />
    );
  }

  if (isOriginalLang) {
    if (spotifyEmbedUrl) {
      return (
        <div ref={iframeRef} className="rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <EmbedFrame variant="icon" href={spotify!}>
          <iframe
            src={spotifyEmbedUrl}
            title={title}
            className="w-full h-20"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
          </EmbedFrame>
        </div>
      );
    }
    if (youtubeEmbedUrl) {
      return (
        <div ref={iframeRef} className="rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <EmbedFrame variant="icon" href={youtube!}>
          <iframe
            src={youtubeEmbedUrl}
            title={title}
            className="w-full h-20"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            loading="lazy"
          />
          </EmbedFrame>
        </div>
      );
    }
    if (navidromeShareUrl) {
      return (
        <div ref={iframeRef} className="rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <EmbedFrame variant="icon" href={navidromeShareUrl}>
          <iframe
            src={navidromeShareUrl}
            title={title}
            className="w-full h-20"
            frameBorder="0"
            loading="lazy"
          />
          </EmbedFrame>
        </div>
      );
    }
    return (
      <div className="text-center py-3 text-xs text-neutral-400">
        {t('setlist.noAudioAvailable')}
      </div>
    );
  }

  // Translated language - Navidrome
  if (navidromeShareUrl) {
    return (
      <div ref={iframeRef} className="rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <EmbedFrame variant="icon" href={navidromeShareUrl}>
        <iframe
          src={navidromeShareUrl}
          title={title}
          className="w-full h-20"
          frameBorder="0"
          loading="lazy"
        />
        </EmbedFrame>
      </div>
    );
  }

  return (
    <div className="text-center py-3 text-xs text-neutral-400">
      {t('voice.noRecordings')}
    </div>
  );
}