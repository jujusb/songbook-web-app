import { normalizeTitle } from '@/lib/navidrome/share';
import { getSpotifyConfig } from './config';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const config = getSpotifyConfig();
  if (!config) throw new Error('Spotify not configured');

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export interface SpotifyItem {
  id: string;
  url: string;
}

interface SpotifyResult {
  name: string;
  id: string;
  external_urls: { spotify: string };
  artists?: { name: string }[];
}

function titleScore(resultName: string, want: string): number {
  const a = normalizeTitle(resultName);
  const b = normalizeTitle(want);
  if (!a || !b) return 0;
  if (a === b) return 2;
  if (a.includes(b) || b.includes(a)) return 1;
  return 0;
}

function artistMatches(result: SpotifyResult, want?: string): boolean {
  if (!want) return true;
  const target = normalizeTitle(want);
  return (result.artists ?? []).some((artist) => {
    const n = normalizeTitle(artist.name);
    return n.includes(target) || target.includes(n);
  });
}

function pickBest<T extends SpotifyResult>(
  items: T[],
  opts: { title: string; artist?: string }
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = titleScore(item.name, opts.title) + (artistMatches(item, opts.artist) ? 1 : 0);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Search Spotify for a track or album matching `title`/`artist` and return the
 * best match (by normalized artist + title), or null when nothing matches well.
 */
export async function searchSpotify(opts: {
  query: string;
  type: 'track' | 'album';
  title: string;
  artist?: string;
}): Promise<SpotifyItem | null> {
  const token = await getAccessToken();
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', opts.query);
  url.searchParams.set('type', opts.type);
  url.searchParams.set('limit', '20');

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);

  const body = (await res.json()) as
    | { tracks?: { items?: (SpotifyResult & { album?: { name: string } })[] } }
    | { albums?: { items?: SpotifyResult[] } };
  const items =
    opts.type === 'track'
      ? (body as { tracks?: { items?: (SpotifyResult & { album?: { name: string } })[] } }).tracks?.items ?? []
      : (body as { albums?: { items?: SpotifyResult[] } }).albums?.items ?? [];

  const best =
    opts.type === 'track'
      ? pickBest(items as SpotifyResult[], { title: opts.title, artist: opts.artist })
      : pickBest(items, { title: opts.title, artist: opts.artist });

  return best ? { id: best.id, url: best.external_urls.spotify } : null;
}