import {
  getAlbum,
  getAlbumTitle,
  getAlbumsForSong,
  getArtist,
  getArtistForSong,
  getSongTitle,
} from '@/lib/content';
import { getNavidromeConfig } from './config';
import {
  SubsonicClient,
  type SubsonicAlbum,
  type SubsonicShare,
  type SubsonicSong,
} from './subsonic';

export interface ShareResult {
  url: string;
  songTitle?: string;
  albumTitle?: string;
  artist?: string;
  /** Audio streaming URL (song share). */
  streamUrl?: string;
  /** Cover art URL. */
  coverArtUrl?: string;
  /** Streamable tracks, used for album shares. */
  songs?: { id: string; title: string; streamUrl: string }[];
}

const MEMO_TTL_MS = 10 * 60 * 1000;
const memo = new Map<string, { at: number; value: ShareResult | null }>();

function memoKey(type: 'song' | 'album', id: string, lang: string): string {
  return `${type}:${id}:${lang}`;
}

async function memoized(
  key: string,
  fn: () => Promise<ShareResult | null>
): Promise<ShareResult | null> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}

function getClient(): SubsonicClient | null {
  const config = getNavidromeConfig();
  return config ? new SubsonicClient(config) : null;
}

/**
 * Normalize a title for fuzzy matching: lowercase, strip accents and
 * punctuation, collapse whitespace.
 */
export function normalizeTitle(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titlesEqual(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  return !!na && !!nb && na === nb;
}

function scoreMatch(candidate: string, expected: string): number {
  const n = normalizeTitle(candidate);
  const e = normalizeTitle(expected);
  if (!n || !e) return 0;
  if (n === e) return 100;
  if (n.includes(e) || e.includes(n)) return 60;
  return 0;
}

function titleMatchesSong(
  song: SubsonicSong,
  songTitle: string,
  artistName?: string
): boolean {
  if (scoreMatch(song.title, songTitle) < 60) return false;
  if (artistName && song.artist && scoreMatch(song.artist, artistName) < 60) {
    return false;
  }
  return true;
}

async function findAlbum(
  client: SubsonicClient,
  opts: { albumTitle: string; artistName?: string }
): Promise<SubsonicAlbum | null> {
  const results = await client.search3({
    query: opts.albumTitle,
    albumCount: 50,
    songCount: 0,
    artistCount: 0,
  });
  let best: { album: SubsonicAlbum; score: number } | null = null;
  for (const album of results.album ?? []) {
    let score = scoreMatch(album.name, opts.albumTitle);
    if (score === 0) continue;
    if (opts.artistName && album.artist) {
      const artistScore = scoreMatch(album.artist, opts.artistName);
      if (artistScore === 0) continue;
      score += artistScore / 10;
    }
    if (!best || score > best.score) best = { album, score };
  }
  return best?.album ?? null;
}

async function findTrack(
  client: SubsonicClient,
  opts: { songTitle: string; albumTitle?: string; artistName?: string }
): Promise<SubsonicSong | null> {
  const { songTitle, artistName } = opts;

  // 1. Resolve the album by its localized title.
  let matchedAlbum: SubsonicAlbum | null = null;
  if (opts.albumTitle) {
    matchedAlbum = await findAlbum(client, {
      albumTitle: opts.albumTitle,
      artistName,
    });
  }

  // 2. Prefer a song found inside the matched album.
  if (matchedAlbum) {
    try {
      const detail = await client.getAlbum(matchedAlbum.id);
      for (const song of detail.song ?? []) {
        if (titleMatchesSong(song, songTitle, artistName)) return song;
      }
    } catch {
      // fall back to the song search below
    }
  }

  // 3. Fallback: search songs by title and filter by album/artist.
  const results = await client.search3({
    query: songTitle,
    songCount: 50,
    albumCount: 0,
    artistCount: 0,
  });
  let best: { song: SubsonicSong; score: number } | null = null;
  for (const song of results.song ?? []) {
    let score = scoreMatch(song.title, songTitle);
    if (score === 0) continue;
    if (matchedAlbum) {
      const inAlbum =
        song.albumId === matchedAlbum.id ||
        (song.album != null && titlesEqual(song.album, matchedAlbum.name));
      if (!inAlbum) continue;
      score += 10;
    }
    if (artistName && song.artist) {
      const artistScore = scoreMatch(song.artist, artistName);
      if (artistScore === 0) continue;
      score += artistScore / 10;
    }
    if (!best || score > best.score) best = { song, score };
  }
  return best?.song ?? null;
}

/**
 * Reuse an existing Navidrome share for the media item when one exists
 * (matched by the id in its entry), otherwise create a new one.
 */
async function createOrGetShare(
  client: SubsonicClient,
  mediaId: string,
  description?: string
): Promise<SubsonicShare> {
  try {
    const shares = await client.getShares();
    const existing = shares.find((share) =>
      share.entry?.some((entry) => entry.id === mediaId)
    );
    if (existing) return existing;
  } catch {
    // getShares failure — fall through and create a fresh share
  }
  return client.createShare(mediaId, description);
}

/**
 * Find the Navidrome track for a song shown in `lang` and return a share link.
 * The album is searched using its localized title for that language, the song
 * by its localized song title. Resolved titles come from Navidrome.
 */
export async function getSongShare(
  songId: string,
  lang: string
): Promise<ShareResult | null> {
  const client = getClient();
  if (!client) return null;
  return memoized(memoKey('song', songId, lang), async () => {
    try {
      const songTitle = await getSongTitle(songId, lang);
      const albums = await getAlbumsForSong(songId);
      const album = albums[0];
      let albumTitle: string | undefined;
      let artistName: string | undefined;

      if (album) {
        albumTitle = await getAlbumTitle(album.id, lang);
        try {
          artistName = (await getArtistForSong(songId))?.name;
        } catch {}
      }

      const track = await findTrack(client, { songTitle, albumTitle, artistName });
      if (!track) return null;

      const share = await createOrGetShare(client, track.id, track.title);

      // Resolve stream + cover art, tolerating failures (share link still shown).
      let streamUrl: string | undefined;
      let coverArtUrl: string | undefined;
      let resolvedAlbum = track.album ?? albumTitle;
      try {
        streamUrl = await client.streamUrl(track.id);
      } catch {}
      try {
        let coverId = track.coverArt;
        if (!coverId && track.albumId) {
          const detail = await client.getAlbum(track.albumId);
          coverId = detail.coverArt;
          if (!resolvedAlbum) resolvedAlbum = detail.name;
        }
        if (coverId) coverArtUrl = await client.coverArtUrl(coverId);
      } catch {}

      return {
        url: share.url,
        songTitle: track.title,
        albumTitle: resolvedAlbum,
        artist: track.artist ?? artistName,
        streamUrl,
        coverArtUrl,
      };
    } catch {
      return null;
    }
  });
}

/**
 * Find the Navidrome album by its localized title and return a share link
 * together with its cover art and per-track streaming URLs.
 */
export async function getAlbumShare(
  albumId: string,
  lang: string
): Promise<ShareResult | null> {
  const client = getClient();
  if (!client) return null;
  return memoized(memoKey('album', albumId, lang), async () => {
    try {
      const album = await getAlbum(albumId);
      const albumTitle = await getAlbumTitle(albumId, lang);
      let artistName: string | undefined;
      try {
        artistName = (await getArtist(album.artist)).name;
      } catch {}

      const found = await findAlbum(client, { albumTitle, artistName });
      if (!found) return null;

      const share = await createOrGetShare(client, found.id);

      let coverArtUrl: string | undefined;
      try {
        if (found.coverArt) coverArtUrl = await client.coverArtUrl(found.coverArt);
      } catch {}

      // Per-track streaming URLs for the matched album.
      const tracks: { id: string; title: string; streamUrl: string }[] = [];
      try {
        const detail = await client.getAlbum(found.id);
        const streams = await Promise.all(
          (detail.song ?? []).map(async (song) => {
            try {
              return { id: song.id, title: song.title, streamUrl: await client.streamUrl(song.id) };
            } catch {
              return null;
            }
          })
        );
        tracks.push(...streams.filter((s): s is { id: string; title: string; streamUrl: string } => s !== null));
      } catch {}

      return {
        url: share.url,
        albumTitle: found.name,
        artist: found.artist,
        coverArtUrl,
        songs: tracks,
      };
    } catch {
      return null;
    }
  });
}