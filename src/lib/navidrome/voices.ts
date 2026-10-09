import { readFile } from 'fs/promises';
import path from 'path';
import { getSongTitle, getContentDir } from '@/lib/content';
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

/** A raw recording on the VOICES instance, with its Navidrome id. */
export interface VoiceTrack {
  id: string;
  title: string;
  coverArt?: string;
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
export const SECTION_ORDER: VoiceSection[] = ['tenor', 'bass', 'alto', 'soprano'];
const SECTION_GENDER: Record<VoiceSection, VoiceGender> = {
  tenor: 'boys',
  bass: 'boys',
  alto: 'girls',
  soprano: 'girls',
};

/**
 * The voice-matching parameters for one language: which labels pin a recording
 * to a single section, which words mean "every section of a gender"
 * (AllBoys / AllGirls), and which generic keywords fall back to a single
 * section.
 */
export interface VoiceLanguageParams {
  /** Specific labels take priority and unambiguously identify a section. */
  specificLabels: { section: VoiceSection; label: string }[];
  /** Words mapping a recording to BOTH boys sections (TENOR + BASS). */
  allBoys: string[];
  /** Words mapping a recording to BOTH girls sections (ALTO + SOPRANO). */
  allGirls: string[];
  /** Generic keywords are fallbacks; the first match wins. */
  keywords: { section: VoiceSection; keywords: string[] }[];
}

const VOICE_SECTIONS: VoiceSection[] = ['tenor', 'bass', 'alto', 'soprano'];

function isVoiceSection(value: unknown): value is VoiceSection {
  return typeof value === 'string' && (VOICE_SECTIONS as string[]).includes(value);
}

/**
 * Generic keywords that apply in every language. They are the stable
 * cross-language code words (the voice-part names themselves) matched as
 * substrings: `tenor`/`boy`, `bass`, `alto`/`girl`, `soprano`/`sopran`.
 */
const KEYWORDS: { section: VoiceSection; keywords: string[] }[] = [
  { section: 'tenor', keywords: ['tenor', 'boy'] },
  { section: 'bass', keywords: ['bass'] },
  { section: 'alto', keywords: ['alto', 'girl'] },
  { section: 'soprano', keywords: ['soprano', 'sopran'] },
];

/**
 * Universal "every section of a gender" words. The AllBoys / AllGirls
 * convention applies to every language: a recording titled
 * `My Song AllBoys` plays in TENOR + BASS, `My Song AllGirls` in
 * ALTO + SOPRANO. Language configs may add their own words on top.
 */
const ALL_BOYS: string[] = ['allboys'];
const ALL_GIRLS: string[] = ['allgirls'];

/**
 * Built-in per-language additions on top of the universal keywords. A language
 * without an entry falls back to `es`-style params (the corpus this app was
 * built for names its recordings in Spanish: `chico`/`chica`, `chicos`/
 * `chicas`). Selectable per language with a matching JSON file — see
 * `loadVoiceMatchingConfig`.
 */
const LANG_PARAMS: Record<string, Partial<VoiceLanguageParams>> = {
  en: {},
  es: {
    specificLabels: [
      { section: 'tenor', label: 'chicos alta' },
      { section: 'bass', label: 'chicos baja' },
      { section: 'alto', label: 'chicas baja' },
      { section: 'soprano', label: 'chicas alta' },
      { section: 'tenor', label: 'chico alta' },
      { section: 'bass', label: 'chico baja' },
      { section: 'alto', label: 'chica baja' },
      { section: 'soprano', label: 'chica alta' },
    ],
    allBoys: ['chico', 'chicos'],
    allGirls: ['chica', 'chicas'],
  },
  fr: {
    keywords: [{ section: 'bass', keywords: ['basse'] }],
  },
};

function mergeKeywords(
  base: { section: VoiceSection; keywords: string[] }[],
  extras: { section: VoiceSection; keywords: string[] }[],
): { section: VoiceSection; keywords: string[] }[] {
  const bySection = new Map(base.map((entry) => [entry.section, [...entry.keywords]]));
  for (const entry of extras) {
    if (!bySection.has(entry.section)) bySection.set(entry.section, []);
    bySection.get(entry.section)!.push(...entry.keywords);
  }
  return [...bySection.entries()].map(([section, keywords]) => ({
    section,
    keywords,
  }));
}

/**
 * JSON file that overrides the built-in per-language vocabulary. Read from
 * `<contentDir>/config/voices.json` by default; point `SONGBOOK_VOICES_MATCHING_FILE`
 * at another path to pass a custom file into Docker. Shape:
 *
 * ```json
 * {
 *   "matching": {
 *     "es": {
 *       "specific": { "chicos alta": "tenor", "chico baja": "bass" },
 *       "allBoys": ["chico", "chicos"],
 *       "allGirls": ["chica", "chicas"],
 *       "keywords": { "bajo": "bass" }
 *     }
 *   }
 * }
 * ```
 *
 * For a language, each provided dimension REPLACES that language's built-in
 * dimension (whatever is absent keeps its built-in value). The universal
 * keywords and the AllBoys/AllGirls words always stay active. When the file is
 * missing or unreadable the built-ins are used unchanged.
 */
export const VOICES_MATCHING_FILE_ENV = 'SONGBOOK_VOICES_MATCHING_FILE';
export const VOICES_MATCHING_FILE_NAME = 'voices.json';

function normalizeLangConfig(raw: Record<string, unknown>): Partial<VoiceLanguageParams> {
  const result: Partial<VoiceLanguageParams> = {};
  if (raw.specific && typeof raw.specific === 'object') {
    const specificLabels: { section: VoiceSection; label: string }[] = [];
    for (const [label, section] of Object.entries(raw.specific)) {
      if (!isVoiceSection(section)) continue;
      const normalized = normalizeTitle(label);
      if (normalized) specificLabels.push({ section, label: normalized });
    }
    if (specificLabels.length > 0) result.specificLabels = specificLabels;
  }
  if (Array.isArray(raw.allBoys)) {
    const allBoys = raw.allBoys
      .filter((word): word is string => typeof word === 'string')
      .map(normalizeTitle)
      .filter((word): word is string => Boolean(word));
    if (allBoys.length > 0) result.allBoys = allBoys;
  }
  if (Array.isArray(raw.allGirls)) {
    const allGirls = raw.allGirls
      .filter((word): word is string => typeof word === 'string')
      .map(normalizeTitle)
      .filter((word): word is string => Boolean(word));
    if (allGirls.length > 0) result.allGirls = allGirls;
  }
  if (raw.keywords && typeof raw.keywords === 'object') {
    const keywords: { section: VoiceSection; keywords: string[] }[] = [];
    for (const [word, section] of Object.entries(raw.keywords)) {
      if (!isVoiceSection(section)) continue;
      const normalized = normalizeTitle(word);
      if (normalized) keywords.push({ section, keywords: [normalized] });
    }
    if (keywords.length > 0) result.keywords = keywords;
  }
  return result;
}

/**
 * Load the per-language matching overrides from the matching JSON file.
 * Returns an empty map when the file is absent or malformed.
 */
export async function loadVoiceMatchingConfig(): Promise<
  Record<string, Partial<VoiceLanguageParams>>
> {
  const filePath =
    process.env[VOICES_MATCHING_FILE_ENV] ??
    path.join(getContentDir(), 'config', VOICES_MATCHING_FILE_NAME);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const matching =
      parsed.matching && typeof parsed.matching === 'object' ? parsed.matching : parsed;
    const result: Record<string, Partial<VoiceLanguageParams>> = {};
    for (const [lang, entry] of Object.entries(matching)) {
      if (!entry || typeof entry !== 'object') continue;
      const langConfig = normalizeLangConfig(entry as Record<string, unknown>);
      if (Object.keys(langConfig).length > 0) result[lang.toLowerCase()] = langConfig;
    }
    return result;
  } catch {
    return {};
  }
}

async function loadParamsForLang(lang: string): Promise<VoiceLanguageParams> {
  const config = await loadVoiceMatchingConfig();
  return getVoiceLanguageParams(lang, config);
}

function getVoiceLanguageParams(
  lang: string,
  config: Record<string, Partial<VoiceLanguageParams>>,
): VoiceLanguageParams {
  const configured = config[lang];
  const builtin = LANG_PARAMS[lang] ?? LANG_PARAMS['es'];
  return {
    specificLabels: configured?.specificLabels ?? builtin.specificLabels ?? [],
    allBoys: [...ALL_BOYS, ...(configured?.allBoys ?? builtin.allBoys ?? [])],
    allGirls: [...ALL_GIRLS, ...(configured?.allGirls ?? builtin.allGirls ?? [])],
    keywords: mergeKeywords(KEYWORDS, configured?.keywords ?? builtin.keywords ?? []),
  };
}

/**
 * Classify a recording title into its section(s) using the resolved matching
 * parameters. Specific labels pin it to a single section; an AllBoys word maps
 * it to BOTH boys sections (TENOR + BASS), an AllGirls word to both girls
 * sections (ALTO + SOPRANO); otherwise generic keywords map it to a single
 * section (first match). The title must also contain the (normalized) song
 * title.
 */
function sectionsFromTitle(
  title: string,
  songTitle: string,
  params: VoiceLanguageParams,
): VoiceSection[] | null {
  const normalized = normalizeTitle(title);
  if (!normalized || !songTitle || !normalized.includes(songTitle)) return null;
  for (const { section, label } of params.specificLabels) {
    if (normalized.includes(label)) return [section];
  }
  if (params.allBoys.some((word) => normalized.includes(word))) return ['tenor', 'bass'];
  if (params.allGirls.some((word) => normalized.includes(word))) return ['alto', 'soprano'];
  for (const { section, keywords } of params.keywords) {
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
  const params = await loadParamsForLang(lang);
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
        const sections = sectionsFromTitle(title, normalizedSongTitle, params);
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
 * Fetch every recording on the VOICES instance in one pass (album list +
 * per-album detail), memoized, keeping the Navidrome track ids.
 */
export async function getAllVoiceTracks(): Promise<VoiceTrack[]> {
  const config = getVoicesConfig();
  if (!config) return [];
  const client = new SubsonicClient(config);
  return memoized('voices:all-tracks', async () => {
    try {
      const albums = await client.getAlbumList2({
        type: 'alphabeticalByName',
        size: 500,
      });
      const tracks: VoiceTrack[] = [];
      const seen = new Set<string>();
      for (const album of albums) {
        try {
          const detail = await client.getAlbum(album.id);
          for (const song of detail.song ?? []) {
            if (!song.id || !song.title) continue;
            const key = `${song.id}::${normalizeTitle(song.title)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            tracks.push({ id: song.id, title: song.title, coverArt: song.coverArt });
          }
        } catch {
          // skip unreadable albums
        }
      }
      return tracks;
    } catch {
      return [];
    }
  });
}

/**
 * Fetch the raw titles of every recording on the VOICES instance (uses the
 * shared memoized dump). Used for cheap "does this song have voice
 * recordings?" lookups without one search per song.
 */
export async function getAllVoiceTrackTitles(): Promise<string[]> {
  const tracks = await getAllVoiceTracks();
  return [...new Set(tracks.map((track) => track.title))];
}

/**
 * Collect the VOICES track ids for each voice section across a set of
 * `{songId, lang}` items (e.g. a setlist), using the one-pass dump and the
 * per-song matching rules. Tracks are deduplicated per section by id AND by
 * normalized title, so the same recording never shows up twice in a section's
 * playlist even when the server stores it under several ids.
 */
export async function getVoiceTrackIdsForSetlist(
  items: { songId: string; lang: string }[],
): Promise<Partial<Record<VoiceSection, VoiceTrack[]>>> {
  const config = getVoicesConfig();
  if (!config) return {};
  if (items.length === 0) return {};
  try {
    const tracks = await getAllVoiceTracks();
    if (tracks.length === 0) return {};
    const matchingConfig = await loadVoiceMatchingConfig();
    const bySection: Record<VoiceSection, Map<string, VoiceTrack>> = {
      tenor: new Map(),
      bass: new Map(),
      alto: new Map(),
      soprano: new Map(),
    };
    for (const item of items) {
      const params = getVoiceLanguageParams(item.lang, matchingConfig);
      let songTitle: string;
      try {
        songTitle = await getSongTitle(item.songId, item.lang);
      } catch {
        continue;
      }
      const normalizedSongTitle = normalizeTitle(songTitle);
      if (!normalizedSongTitle) continue;
      for (const track of tracks) {
        const sections = sectionsFromTitle(track.title, normalizedSongTitle, params);
        if (!sections) continue;
        const titleKey = normalizeTitle(track.title);
        for (const section of sections) {
          const map = bySection[section];
          // Some recordings exist twice on the server under different ids;
          // never list the same track name twice within one section.
          const containsSameTitle =
            !titleKey ||
            [...map.values()].some((t) => normalizeTitle(t.title) === titleKey);
          if (map.has(track.id) || containsSameTitle) continue;
          map.set(track.id, track);
        }
      }
    }
    const result: Partial<Record<VoiceSection, VoiceTrack[]>> = {};
    for (const section of SECTION_ORDER) {
      const list = [...bySection[section].values()];
      if (list.length > 0) result[section] = list;
    }
    return result;
  } catch {
    return {};
  }
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
    const params = await loadParamsForLang(lang);
    const songTitle = await getSongTitle(songId, lang);
    const normalizedSongTitle = normalizeTitle(songTitle);
    if (!normalizedSongTitle) return false;
    const titles = await getAllVoiceTrackTitles();
    return titles.some(
      (title) => sectionsFromTitle(title, normalizedSongTitle, params) !== null,
    );
  } catch {
    return false;
  }
}

/**
 * Batch check: for multiple songs, check which have voice sections.
 * Fetches all voice track titles ONCE and checks all songs in memory.
 */
export async function hasVoiceSectionsBatch(
  songIds: string[],
  lang: string,
): Promise<Map<string, boolean>> {
  const config = getVoicesConfig();
  if (!config) {
    return new Map(songIds.map(id => [id, false]));
  }
  try {
    const params = await loadParamsForLang(lang);
    const titles = await getAllVoiceTrackTitles();
    const result = new Map<string, boolean>();
    
    // Get all song titles first
    const songTitles = await Promise.all(
      songIds.map(async (songId) => {
        try {
          const title = await getSongTitle(songId, lang);
          return { songId, normalized: normalizeTitle(title) };
        } catch {
          return { songId, normalized: null };
        }
      })
    );
    
    // Check each song against all voice track titles
    for (const { songId, normalized } of songTitles) {
      if (!normalized) {
        result.set(songId, false);
        continue;
      }
      const hasVoice = titles.some(
        (title) => sectionsFromTitle(title, normalized, params) !== null,
      );
      result.set(songId, hasVoice);
    }
    
    return result;
  } catch {
    return new Map(songIds.map(id => [id, false]));
  }
}