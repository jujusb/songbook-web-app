import { getSongTitle } from '@/lib/content';
import { getVoicesConfig } from './config';
import { SubsonicClient } from './subsonic';
import { normalizeTitle } from './share';

export type VoiceSection = 'tenor' | 'bass' | 'alto' | 'soprano';
export type VoiceGender = 'boys' | 'girls';

export interface VoicePart {
  title: string;
  streamUrl: string;
  coverArtUrl?: string;
}

export interface VoiceSectionGroup {
  section: VoiceSection;
  parts: VoicePart[];
}

export interface VoiceGroup {
  gender: VoiceGender;
  sections: VoiceSectionGroup[];
}

const GENDER_ORDER: VoiceGender[] = ['boys', 'girls'];
const SECTION_ORDER: VoiceSection[] = ['tenor', 'bass', 'alto', 'soprano'];
const SECTION_GENDER: Record<VoiceSection, VoiceGender> = {
  tenor: 'boys',
  bass: 'boys',
  alto: 'girls',
  soprano: 'girls',
};

/**
 * Specific labels take priority and unambiguously identify a section. The
 * generic keywords are fallbacks and map each recording to a single section
 * (first match) to avoid showing the same player twice.
 */
const SPECIFIC_LABELS: { section: VoiceSection; label: string }[] = [
  { section: 'tenor', label: 'chicos alta' },
  { section: 'bass', label: 'chicos baja' },
  { section: 'alto', label: 'chicas baja' },
  { section: 'soprano', label: 'chicas alta' },
];

const KEYWORDS: { section: VoiceSection; keywords: string[] }[] = [
  { section: 'tenor', keywords: ['tenor', 'boy'] },
  { section: 'bass', keywords: ['bass'] },
  { section: 'alto', keywords: ['alto', 'girl'] },
  { section: 'soprano', keywords: ['soprano', 'sopran'] },
];

/**
 * Classify a recording title into its section(s). Specific labels pin it to a
 * single section; a bare `chico`/`chica` (no alta/baja modifier) is shown in
 * BOTH sections of that gender (TENOR+BASS for chicos, ALTO+SOPRANO for
 * chicas). The title must also contain the (normalized) song title.
 */
function sectionsFromTitle(
  title: string,
  songTitle: string,
): VoiceSection[] | null {
  const normalized = normalizeTitle(title);
  if (!normalized || !songTitle || !normalized.includes(songTitle)) return null;
  for (const { section, label } of SPECIFIC_LABELS) {
    if (normalized.includes(label)) return [section];
  }
  if (normalized.includes('chico')) return ['tenor', 'bass'];
  if (normalized.includes('chica')) return ['alto', 'soprano'];
  for (const { section, keywords } of KEYWORDS) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return [section];
  }
  return null;
}

const MEMO_TTL_MS = 10 * 60 * 1000;
const memo = new Map<string, { at: number; value: unknown }>();

async function memoized<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value as T;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Find the voice-part recordings for a song on the VOICES Navidrome instance
 * by searching the current-language song title and classifying each result
 * into a section (TENOR / BASS / ALTO / SOPRANO). Every matching recording is
 * returned, deduplicated by title, and grouped into Chicos (boys) and Chicas
 * (girls) with their sections in fixed order.
 */
export async function getVoiceSections(songId: string, lang: string): Promise<VoiceGroup[]> {
  const config = getVoicesConfig();
  if (!config) return [];
  const client = new SubsonicClient(config);
  return memoized(`voices:${songId}:${lang}`, async () => {
    try {
      const songTitle = await getSongTitle(songId, lang);
      const normalizedSongTitle = normalizeTitle(songTitle);
      const searched = await client.search3({ query: songTitle, songCount: 60, albumCount: 0, artistCount: 0 });
      const tracks = searched.song ?? [];

      const bySection = new Map<VoiceSection, VoicePart[]>();
      const seen = new Set<string>();
      for (const track of tracks) {
        const title = track.title ?? '';
        const sections = sectionsFromTitle(title, normalizedSongTitle);
        if (!sections) continue;
        const key = normalizeTitle(title);
        if (!key || seen.has(key)) continue;
        seen.add(key);

        let streamUrl: string | undefined;
        let coverArtUrl: string | undefined;
        try {
          streamUrl = await client.streamUrl(track.id);
        } catch {}
        try {
          if (track.coverArt) coverArtUrl = await client.coverArtUrl(track.coverArt, 128);
        } catch {}
        if (!streamUrl) continue;

        for (const section of sections) {
          const parts = bySection.get(section) ?? [];
          parts.push({ title, streamUrl, coverArtUrl });
          bySection.set(section, parts);
        }
      }

      const groups: VoiceGroup[] = [];
      for (const gender of GENDER_ORDER) {
        const sections = SECTION_ORDER.filter(
          (section) => SECTION_GENDER[section] === gender,
        ).map((section) => ({ section, parts: bySection.get(section) ?? [] }));
        if (sections.some(({ parts }) => parts.length > 0)) {
          groups.push({ gender, sections });
        }
      }
      return groups;
    } catch {
      return [];
    }
  });
}

/**
 * Fetch the raw titles of every recording on the VOICES instance in one pass
 * (album list + per-album detail), memoized. Used for cheap "does this song
 * have voice recordings?" lookups without one search per song.
 */
export async function getAllVoiceTrackTitles(): Promise<string[]> {
  const config = getVoicesConfig();
  if (!config) return [];
  const client = new SubsonicClient(config);
  return memoized('voices:all-titles', async () => {
    try {
      const albums = await client.getAlbumList2({
        type: 'alphabeticalByName',
        size: 500,
      });
      const titles = new Set<string>();
      for (const album of albums) {
        try {
          const detail = await client.getAlbum(album.id);
          for (const song of detail.song ?? []) {
            if (song.title) titles.add(song.title);
          }
        } catch {
          // skip unreadable albums
        }
      }
      return [...titles];
    } catch {
      return [];
    }
  });
}

/**
 * Boolean check: does the VOICES instance have at least one recording that
 * matches this song in the given language? Reuses the per-song matching rules.
 */
export async function hasVoiceSections(
  songId: string,
  lang: string,
): Promise<boolean> {
  const config = getVoicesConfig();
  if (!config) return false;
  try {
    const songTitle = await getSongTitle(songId, lang);
    const normalizedSongTitle = normalizeTitle(songTitle);
    if (!normalizedSongTitle) return false;
    const titles = await getAllVoiceTrackTitles();
    return titles.some(
      (title) => sectionsFromTitle(title, normalizedSongTitle) !== null,
    );
  } catch {
    return false;
  }
}