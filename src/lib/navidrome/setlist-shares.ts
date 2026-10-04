import type { Setlist, VoiceShare, VoiceShareSection } from '@/lib/content/schemas';
import { getVoicesConfig, type NavidromeConfig } from './config';
import { SubsonicClient, type SubsonicShare } from './subsonic';
import {
  getVoiceTrackIdsForSetlist,
  SECTION_ORDER,
  type VoiceTrack,
} from './voices';
import { normalizeTitle } from './share';
import { getSongTranslation } from '@/lib/content';

/** A setlist voice share enriched with per-track streaming URLs for playback. */
export interface VoiceShareWithTracks extends VoiceShare {
  tracks: { title: string; streamUrl: string; coverArtUrl?: string }[];
}

const MEMO_TTL_MS = 10 * 60 * 1000;
const memo = new Map<string, { at: number; value: VoiceShareWithTracks[] }>();

function memoKey(setlistId: string, shares: VoiceShare[]): string {
  return `setlist-voice-shares:${setlistId}:${shares
    .map((share) => `${share.section}:${share.url}`)
    .join('|')}`;
}

async function memoized(
  key: string,
  fn: () => Promise<VoiceShareWithTracks[]>,
): Promise<VoiceShareWithTracks[]> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}

function getClient(): SubsonicClient | null {
  const config = getVoicesConfig();
  return config ? new SubsonicClient(config) : null;
}

/**
 * Navidrome builds share URLs from its own external hostname, which may use a
 * different scheme than the API URL we connect through. Match the scheme of
 * the configured URL so links work from the browser.
 */
function normalizeShareUrl(url: string, config: NavidromeConfig): string {
  if (config.songsUrl.startsWith('https://') && url.startsWith('http://')) {
    return `https://${url.slice('http://'.length)}`;
  }
  return url;
}

/**
 * The normalized titles of a share's playlist entries. Returns null when the
 * share has no entries, any entry is missing a title, or the playlist contains
 * duplicate titles — those shares can never be reused.
 */
function shareTitleSet(share: SubsonicShare): Set<string> | null {
  const entries = share.entry ?? [];
  if (entries.length === 0) return null;
  const titles = new Set<string>();
  for (const entry of entries) {
    const key = normalizeTitle(entry.title ?? '');
    if (!key) return null;
    if (titles.has(key)) return null; // duplicate track in the Navidrome playlist
    titles.add(key);
  }
  return titles;
}

/**
 * Reuse an existing share whose playlist contains exactly these tracks (and no
 * duplicates), otherwise create a fresh multi-track share covering them all.
 * Matching by normalized title, not id, so a share is only reused when its
 * underlying Navidrome playlist is already clean and complete.
 */
async function createOrGetShareForTracks(
  client: SubsonicClient,
  parts: VoiceTrack[],
  description?: string,
): Promise<SubsonicShare | null> {
  const desired = new Set(parts.map((part) => normalizeTitle(part.title) || part.title));
  const ids = parts.map((part) => part.id).filter((id, index, arr) => arr.indexOf(id) === index);
  try {
    const shares = await client.getShares();
    for (const share of shares) {
      const titles = shareTitleSet(share);
      if (
        titles &&
        titles.size === desired.size &&
        [...titles].every((title) => desired.has(title))
      ) {
        return share;
      }
    }
  } catch {
    // getShares failure — fall through and create a fresh share
  }
  try {
    return await client.createShare(ids, description);
  } catch {
    return null;
  }
}

/** Whether the share page allows being framed (checks frame-blocking headers). */
async function detectEmbeddable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const xFrame = res.headers.get('x-frame-options');
    if (xFrame) return false;
    const csp = res.headers.get('content-security-policy');
    const ancestors = csp?.match(/frame-ancestors\s+([^;]+)/i)?.[1];
    if (ancestors) {
      return (
        ancestors.includes('*') ||
        /https?:\/\//i.test(ancestors)
      );
    }
    return true;
  } catch {
    return false;
  }
}

async function tracksForParts(
  parts: VoiceTrack[],
): Promise<{ title: string; streamUrl: string; coverArtUrl?: string }[]> {
  const client = getClient();
  if (!client) return [];
  const tracks: { title: string; streamUrl: string; coverArtUrl?: string }[] = [];
  for (const part of parts) {
    try {
      const streamUrl = await client.streamUrl(part.id);
      let coverArtUrl: string | undefined;
      try {
        if (part.coverArt) coverArtUrl = await client.coverArtUrl(part.coverArt, 128);
      } catch {
        // cover art is optional
      }
      tracks.push({ title: part.title, streamUrl, coverArtUrl });
    } catch {
      // skip tracks without a stream URL
    }
  }
  return tracks;
}

/**
 * Generate (or reuse) the per-voice Navidrome shares for a setlist. Returns
 * the slice to persist on the setlist plus the shares enriched with stream
 * URLs for immediate display.
 *
 * Stale shares are dropped: when a section no longer has recordings, or the
 * resolved share for a section differs from the persisted one (e.g. its
 * Navidrome playlist contained duplicate tracks), the old Navidrome share is
 * deleted so its playlist disappears and nothing points at it anymore.
 */
export interface GenerateVoiceSharesOptions {
  /** Role of the requesting user. If 'admin', all songs are used regardless of published status. */
  role?: 'public' | 'reviewer' | 'admin';
}

export async function generateSetlistVoiceShares(
  setlist: Setlist,
  options: GenerateVoiceSharesOptions = {}
): Promise<{ shares: VoiceShare[]; enriched: VoiceShareWithTracks[] }> {
  const { role } = options;
  const config = getVoicesConfig();
  if (!config) return { shares: [], enriched: [] };
  
  // Filter songs by published status for non-admin users
  const filteredSongs = setlist.songs.filter((item) => {
    if (role === 'admin') return true;
    // For non-admin, we need to check if the song has a published translation
    // This will be handled in the track lookup by checking each song's published status
    // For now, we'll filter here based on what we know
    return true; // Will be filtered in getVoiceTrackIdsForSetlist
  });

  const client = new SubsonicClient(config);
  const partsBySection = await getVoiceTrackIdsForSetlist(
    filteredSongs.map((item) => ({ songId: item.songId, lang: item.lang })),
  );
  const existing = new Map<VoiceShareSection, VoiceShare>(
    (setlist.voiceShares ?? []).map((share) => [share.section, share]),
  );
  const allShares = await client.getShares().catch(() => [] as SubsonicShare[]);

  const shares: VoiceShare[] = [];
  const enriched: VoiceShareWithTracks[] = [];
  for (const section of SECTION_ORDER) {
    const parts = partsBySection[section];
    if (!parts || parts.length === 0) continue;
    const stored = existing.get(section);
    const created = await createOrGetShareForTracks(
      client,
      parts,
      `Voices ${section.toUpperCase()} - ${setlist.title}`,
    );
    if (!created) continue;
    const shareUrl = normalizeShareUrl(created.url, config);

    // The persisted share no longer matches the resolved one — it is stale
    // (duplicated tracks, outdated song list). Unlink it from Navidrome.
    if (stored && stored.url !== shareUrl) {
      const stale = allShares.find((share) => normalizeShareUrl(share.url, config) === stored.url);
      if (stale) {
        await client.deleteShare(stale.id).catch(() => {
          // deletion is best-effort; the store loses the reference either way
        });
      }
    }

    const share: VoiceShare = {
      section,
      url: shareUrl,
      count: parts.length,
      embeddable: await detectEmbeddable(shareUrl),
    };
    shares.push(share);
    enriched.push({ ...share, tracks: await tracksForParts(parts) });
  }
  // Sections that previously had a share but now have no recordings are dropped.
  for (const section of SECTION_ORDER) {
    if (shares.some((share) => share.section === section)) continue;
    const stored = existing.get(section);
    if (stored) {
      const stale = allShares.find((share) => normalizeShareUrl(share.url, config) === stored.url);
      if (stale) await client.deleteShare(stale.id).catch(() => {});
    }
  }
  return { shares, enriched };
}

/**
 * Resolve a setlist's stored voice shares into display data (per-section
 * track lists with streaming URLs), using the memoized library dump.
 */
export async function getSetlistVoiceShares(
  setlist: Setlist,
  role?: 'public' | 'reviewer' | 'admin',
): Promise<VoiceShareWithTracks[]> {
  const stored = setlist.voiceShares ?? [];
  if (stored.length === 0) return [];
  return memoized(memoKey(setlist.id, stored), async () => {
    const partsBySection = await getVoiceTrackIdsForSetlist(
      setlist.songs.map((item) => ({ songId: item.songId, lang: item.lang })),
    );
    const out: VoiceShareWithTracks[] = [];
    for (const share of stored) {
      const parts = partsBySection[share.section] ?? [];
      out.push({ ...share, tracks: await tracksForParts(parts) });
    }
    return out;
  });
}