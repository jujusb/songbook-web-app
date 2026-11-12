import { toFileCode, toAppCode } from '@/lib/language-codes';
import { readdir, readFile, writeFile, mkdir, rm, rename } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import * as yaml from 'js-yaml';
import { saveRevision, moveRevisions } from './revisions';
import { getContentDir, getLibraryDir, findSongPath, findSongAlbumId, getSetlistsDir, getConfigDir } from './paths';
import { syncSongToMusicDir } from '@/lib/lyrics-sync';
import { isReadOnly } from '@/lib/readonly';
import { FALLBACK_LANGUAGES } from '@/lib/i18n/labels';
import { getSetlistDefaultMode } from '@/lib/config';
export { resolveSongListTitle } from '../song-titles';
export { getContentDir, findSongPath } from './paths';
import {
  SongMetaSchema,
  SongTranslationFrontmatterSchema,
  LanguagesConfigSchema,
  SiteConfigSchema,
  AlbumSchema,
  ArtistSchema,
  SetlistSchema,
  isReservedSetlistId,
  isSongItem,
  isNoteItem,
  isLinkItem,
  isRecurrentNoteItem,
  type SongMeta,
  type SongTranslationFrontmatter,
  type LanguagesConfig,
  type SiteConfig,
  type Album,
  type Artist,
  type Setlist,
  type SetlistInput,
  type SetlistItem,
} from './schemas';

/**
 * Special pseudo-album for songs that don't belong to any album. Songs live in
 * `content/library/no-album/<song-id>/` and are intentionally NOT registered in
 * any `album.yaml`, so album listing, browse, artists and print ignore them
 * until they are moved into a real album.
 */
export const NO_ALBUM_ID = 'no-album';

// --- Various Artists (default artist) ---

const VARIOUS_ARTISTS: Artist = {
  id: 'various-artists',
  name: 'Various Artists',
  bio: 'Songs and albums by multiple or unknown artists.',
  tags: [],
};

export async function ensureVariousArtists(): Promise<void> {
  const filePath = path.join(getContentDir(), 'artists', 'various-artists.yaml');
  if (!existsSync(filePath)) {
    await saveArtist(VARIOUS_ARTISTS);
  }
}

// --- Songs ---
// Songs live at: content/library/<album-id>/<song-id>/

export type SongListItem = SongMeta & {
  translations: string[];
  /**
   * Per-language titles extracted from the .cho files, used as a fallback
   * when the meta.yaml `titles` map has no entry for a language. The default
   * language is excluded — its yaml `title` is authoritative.
   */
  choTitles: Record<string, string>;
  /** Per-language published status from translation frontmatter */
  published?: Record<string, boolean>;
  /** Per-language chords-published status from translation frontmatter */
  chordsPublished?: Record<string, boolean>;
};

export interface ListSongsOptions {
  /** If true, only include songs that have at least one published translation.
   *  If false (default), include all songs. */
  onlyPublished?: boolean;
  /** Role of the requesting user. If 'admin', all songs are returned regardless of published status. */
  role?: 'public' | 'reviewer' | 'admin' | 'setlist_creator';
}

/**
 * The songs of the library.
 *
 * On the read-only (public) instance the draft translations are left out of
 * the result: they are not served there, so the lists must not announce a
 * language that is not deployed either.
 */
export async function listSongs(options: ListSongsOptions = {}): Promise<SongListItem[]> {
  const { onlyPublished = false, role } = options;
  const libDir = getLibraryDir();
  const songs: SongListItem[] = [];
  const langConfig = await getLanguagesConfig().catch(() => null);
  const defaultLang = langConfig?.default ?? 'en-US';

  try {
    const albumDirs = await readdir(libDir, { withFileTypes: true });
    for (const albumDir of albumDirs) {
      if (!albumDir.isDirectory()) continue;
      const albumPath = path.join(libDir, albumDir.name);
      const entries = await readdir(albumPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const songPath = path.join(albumPath, entry.name);
          const metaPath = path.join(songPath, 'meta.yaml');
          const raw = await readFile(metaPath, 'utf-8');
          const parsed = yaml.load(raw);
          const meta = SongMetaSchema.parse(parsed);
          let translations: string[] = [];
          const publishedMap: Record<string, boolean> = {};
          const chordsPublishedMap: Record<string, boolean> = {};
          try {
            const files = await readdir(songPath);
            translations = files
              .filter((f) => f.endsWith('.cho'))
              .map((f) => toAppCode(path.basename(f, '.cho')));
            // Read published status from each translation
            for (const lang of translations) {
              publishedMap[lang] = await isPublishedTranslation(songPath, lang);
              chordsPublishedMap[lang] = await isChordsPublishedTranslation(songPath, lang);
            }
          } catch {
            // no .cho files readable
          }
          // The public instance does not serve drafts, so it does not list
          // them either: a language that is not deployed stays invisible.
          if (isReadOnly()) {
            translations = translations.filter((lang) => publishedMap[lang]);
            for (const lang of Object.keys(publishedMap)) {
              if (!publishedMap[lang]) delete publishedMap[lang];
            }
            for (const lang of Object.keys(chordsPublishedMap)) {
              if (!publishedMap[lang]) delete chordsPublishedMap[lang];
            }
          }
          const choTitles: Record<string, string> = {};
          for (const lang of translations) {
            if (lang === defaultLang) continue;
            if (meta.titles?.[lang] || meta.titles?.[toFileCode(lang)]) continue;
            try {
              const choRaw = await readFile(path.join(songPath, `${toFileCode(lang)}.cho`), 'utf-8');
              const { data, content } = matter(choRaw);
              const fmTitle =
                typeof data.title === 'string' ? data.title.trim() : '';
              const bodyTitle = extractBodyTitle(content);
              const resolved = fmTitle || bodyTitle;
              if (resolved) choTitles[lang] = resolved;
            } catch {
              // skip unreadable translation file
            }
          }
          // Check if song has any published translation
          const hasPublished = Object.values(publishedMap).some(v => v);
          // Filter based on role and published status. The public instance
          // never lists a song that has no deployed translation.
          if (
            onlyPublished &&
            (role !== 'admin' || isReadOnly()) &&
            !hasPublished
          ) {
            continue; // skip unpublished songs for non-admin
          }
          songs.push({ ...meta, translations, choTitles, published: publishedMap, chordsPublished: chordsPublishedMap });
        } catch {
          // skip invalid
        }
      }
    }
  } catch {
    // library dir doesn't exist yet
  }

  return songs;
}

/**
 * Get all song IDs that have a translation in the given language,
 * sorted alphabetically by ID. Used for next/previous navigation.
 */
export async function getSongIdsByLanguage(lang: string): Promise<string[]> {
  const songs = await listSongs({ onlyPublished: false, role: 'admin' });
  return songs
    .filter((s) => s.translations.includes(lang))
    .map((s) => s.id)
    .sort();
}

/**
 * Resolve the localized title for a song meta in a given language.
 * Falls back to the song's default title when no language-specific title exists.
 */
export function resolveLocalizedTitle(meta: SongMeta, lang: string): string {
  const titleKey = (meta.titles?.[lang] ?? meta.titles?.[toFileCode(lang)]);
  return (typeof titleKey === 'string' ? titleKey : meta.title);
}

/**
 * Decide whether a song should appear in a list for the selected language.
 * When the selected language is the site's default language, every song is
 * shown; otherwise only songs that actually have that translation.
 *
 * On the public (read-only) instance the default language is not a shortcut:
 * a song is only listed in a language when that language is deployed, so a
 * song published in one language does not show up in another one.
 */
export function shouldShowSongInLanguage(
  translations: string[],
  selectedLang: string,
  defaultLang: string
): boolean {
  if (!selectedLang) return true;
  if (isReadOnly()) return translations.includes(selectedLang);
  if (selectedLang === defaultLang) return true;
  return translations.includes(selectedLang);
}

/**
 * Extract the {title: ...} directive value from a ChordPro body, if present.
 */
export function extractBodyTitle(body: string): string | null {
  const match = body.match(/\{title:\s*([^}\n\r]+)\}/i);
  return match ? match[1].trim() : null;
}
export function extractBodyCapo(body: string): number | null {
  const match = body.match(/\{capo:\s*(\d+)\}/i);
  return match ? parseInt(match[1], 10) : null;
}

export function extractBodyKey(body: string): string | null {
  const match = body.match(/\{key:\s*([^}\n\r]+)\}/i);
  return match ? match[1].trim() : null;
}



/**
 * Get the localized title for a song in a given language.
 * Resolution order: meta.titles[lang] → translation frontmatter title →
 * {title: ...} directive in the .cho body → song's default title.
 */
export async function getSongTitle(songId: string, lang: string): Promise<string> {
  try {
    const meta = await getSong(songId);
    const resolved = meta.titles?.[lang] ?? meta.titles?.[toFileCode(lang)];
    if (resolved) return resolved;
    try {
      const { meta: transMeta, body } = await getSongTranslation(songId, lang);
      if (transMeta.title) return transMeta.title;
      const bodyTitle = extractBodyTitle(body);
      if (bodyTitle) return bodyTitle;
    } catch {
      // no translation available
    }
    return meta.title;
  } catch {
    return songId;
  }
}

/**
 * Get the localized title for an album in a given language.
 * Falls back to the album's default title if no translation exists.
 */
export async function getAlbumTitle(albumId: string, lang: string): Promise<string> {
  try {
    const album = await getAlbum(albumId);
    const albumTitle = album.titles?.[lang] ?? album.titles?.[toFileCode(lang)];
  return (typeof albumTitle === 'string' ? albumTitle : album.title);
  } catch {
    return albumId;
  }
}

async function hydrateSetlist(root: Setlist): Promise<Setlist> {
  const date = isSetlistDate(root.date) ? root.date : undefined;
  if (!date) {
    // Backward compatibility: older root files may still hold full content.
    return root;
  }
  const versionPath = path.join(getSetlistsDir(), root.id, date, 'setlist.yaml');
  if (!existsSync(versionPath)) {
    return root;
  }
  try {
    const raw = await readFile(versionPath, 'utf-8');
    const version = SetlistSchema.parse(yaml.load(raw));
    return {
      ...root,
      description: version.description,
      // The current version folder is named after the root date, which is the
      // authoritative event date even if the version file has a stale date.
      date: root.date,
      image: version.image,
      songs: version.songs,
      voiceShares: version.voiceShares,
      mode: version.mode ?? root.mode,
    };
  } catch {
    return root;
  }
}
// Setlists live at: <data>/setlists/<setlist-id>.yaml (falls back to content/setlists)

export interface ListSetlistsOptions {
  /** If provided, include reference setlists owned by this user (saved shared setlists). */
  userId?: string;
}

export async function listSetlists(options: ListSetlistsOptions = {}): Promise<Setlist[]> {
  const { userId } = options;
  const dir = getSetlistsDir();
  try {
    const entries = await readdir(dir);
    const setlists: Setlist[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;
      try {
        const raw = await readFile(path.join(dir, entry), 'utf-8');
        const parsed = yaml.load(raw);
        const setlist = SetlistSchema.parse(parsed);
        // Skip reference setlists unless userId matches owner
        if (setlist.sharedFrom && setlist.ownerId !== userId) {
          continue;
        }
        setlists.push(await hydrateSetlist(setlist));
      } catch {}
    }
    // Sort by date descending (newest first), then by title
    setlists.sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return a.title.localeCompare(b.title);
    });
    return setlists;
  } catch {
    return [];
  }
}

export async function getSetlist(id: string): Promise<Setlist> {
  const filePath = path.join(getSetlistsDir(), `${id}.yaml`);
  const raw = await readFile(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  const root = SetlistSchema.parse(parsed);

  // Hydrate the active version's mutable content from its dated folder when
  // the root only stores shared/static metadata.
  const hydrated = await hydrateSetlist(root);

  // If this is a reference setlist, merge with original
  if (hydrated.sharedFrom) {
    try {
      const original = await getSetlist(hydrated.sharedFrom.setlistId);
      return {
        ...hydrated,
        // Override with original's mutable content
        title: original.title,
        description: original.description,
        date: original.date,
        songs: original.songs,
        voiceShares: original.voiceShares,
        image: original.image,
      };
    } catch {
      // If original not found, return reference as-is
      return hydrated;
    }
  }
  return hydrated;
}

/**
 * Find a setlist by its share identifier: either the auto-generated share
 * token or the optional custom slug. Both are accepted so a slug never breaks
 * a link shared before it was set.
 */
export async function findSetlistByShareToken(token: string): Promise<Setlist | null> {
  if (!token) return null;
  const setlists = await listSetlists();
  return setlists.find((s) => s.shareToken === token || s.shareSlug === token) ?? null;
}

export interface SetlistVersionInfo {
  label: string;
  path: string;
  title: string;
  /** Date stored in the version YAML. */
  date?: string;
  /** Date used for history/statistics: YAML date first, folder label fallback. */
  eventDate?: string;
  description?: string;
}

interface StoredSetlistVersion {
  label: string;
  raw: string;
  setlist: Setlist;
}

const SETLIST_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VERSION_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

export function isSetlistDate(value: unknown): value is string {
  return typeof value === 'string' && SETLIST_DATE_PATTERN.test(value);
}

/** Extract the event date prefix from a version folder label (`YYYY-MM-DD…`). */
export function parseSetlistVersionDate(label: string): string | null {
  const match = VERSION_DATE_PREFIX.exec(label);
  return match ? match[1] : null;
}

/**
 * Stable fingerprint of the content that belongs in history. Share settings,
 * mode, subscribers and generated voice shares are deliberately excluded: they
 * must not create a new dated version.
 */
export function setlistContentKey(setlist: Setlist): string {
  return JSON.stringify({
    title: setlist.title,
    description: setlist.description ?? '',
    date: setlist.date ?? '',
    image: setlist.image ?? '',
    songs: setlist.songs.map((item) => {
      if (isNoteItem(item)) return { type: 'note', id: item.id, text: item.text };
      if (isLinkItem(item)) return { type: 'link', id: item.id, url: item.url, title: item.title ?? '' };
      if (isRecurrentNoteItem(item)) {
        return { type: 'recurrent-note', id: item.id, noteId: item.noteId, date: item.date };
      }
      if (isSongItem(item)) return { type: 'song', songId: item.songId, lang: item.lang };
      return item;
    }),
  });
}

async function readSetlistVersions(baseId: string): Promise<StoredSetlistVersion[]> {
  const versionsDir = path.join(getSetlistsDir(), baseId);
  if (!existsSync(versionsDir)) return [];
  const result: StoredSetlistVersion[] = [];
  try {
    const entries = await readdir(versionsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fp = path.join(versionsDir, entry.name, 'setlist.yaml');
      if (!existsSync(fp)) continue;
      try {
        const raw = await readFile(fp, 'utf-8');
        const setlist = SetlistSchema.parse(yaml.load(raw));
        result.push({ label: entry.name, raw, setlist });
      } catch {
        // skip invalid version
      }
    }
  } catch {
    // versions directory is unreadable
  }
  return result;
}

async function findVersionWithKey(baseId: string, key: string): Promise<string | null> {
  const versions = await readSetlistVersions(baseId);
  return versions.find((version) => setlistContentKey(version.setlist) === key)?.label ?? null;
}

/** A date label if available, otherwise a timestamped label to avoid overwrites. */
async function uniqueVersionLabel(baseId: string, date: string): Promise<string> {
  const versionsDir = path.join(getSetlistsDir(), baseId);
  if (!existsSync(path.join(versionsDir, date))) return date;

  const time = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
  let label = `${date}T${time}`;
  let counter = 2;
  while (existsSync(path.join(versionsDir, label))) {
    label = `${date}T${time}-${counter++}`;
  }
  return label;
}

export async function saveSetlist(setlist: SetlistInput): Promise<void> {
  const validated = SetlistSchema.parse(setlist);
  if (isReservedSetlistId(validated.id)) {
    throw new Error(`"${validated.id}" is a reserved setlist id`);
  }
  const dir = getSetlistsDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${validated.id}.yaml`);

  const existingRoot = existsSync(filePath)
    ? SetlistSchema.parse(yaml.load(await readFile(filePath, 'utf-8')))
    : null;
  const existingCurrent = existingRoot ? await hydrateSetlist(existingRoot) : null;

  const date = isSetlistDate(validated.date)
    ? validated.date
    : isSetlistDate(existingCurrent?.date)
      ? existingCurrent!.date
      : null;

  if (date) {
    const version: Setlist = {
      ...validated,
      date,
      title: validated.title,
      mode: validated.mode || existingCurrent?.mode || getSetlistDefaultMode(),
      modified: new Date().toISOString(),
    };
    const versionDir = path.join(dir, validated.id, date);
    await mkdir(versionDir, { recursive: true });
    await writeFile(path.join(versionDir, 'setlist.yaml'), yaml.dump(version, { lineWidth: -1 }), 'utf-8');
  }

  const rootMeta = {
    id: validated.id,
    title: validated.title,
    date: date ?? undefined,
    public: validated.public ?? existingRoot?.public ?? false,
    shareToken: validated.shareToken ?? existingRoot?.shareToken,
    shareSlug: validated.shareSlug ?? existingRoot?.shareSlug,
    ownerId: validated.ownerId ?? existingRoot?.ownerId,
    created: existingRoot?.created ?? validated.created ?? new Date().toISOString(),
    modified: new Date().toISOString(),
    subscribers: validated.subscribers ?? existingRoot?.subscribers ?? [],
  };

  if (!date) {
    // Preserve undated setlists using the legacy root layout.
    await writeFile(filePath, yaml.dump({
      ...rootMeta,
      ...validated,
      mode: validated.mode || getSetlistDefaultMode(),
      modified: new Date().toISOString(),
    }, { lineWidth: -1 }), 'utf-8');
  } else {
    await writeFile(filePath, yaml.dump(rootMeta, { lineWidth: -1 }), 'utf-8');
  }
}

export async function deleteSetlist(id: string): Promise<void> {
  const filePath = path.join(getSetlistsDir(), `${id}.yaml`);
  await rm(filePath);
}

export async function getSetlistVersion(baseId: string, versionLabel: string): Promise<Setlist> {
  const fp = path.join(getSetlistsDir(), baseId, versionLabel, 'setlist.yaml');
  if (!existsSync(fp)) throw new Error('Version not found');
  const raw = await readFile(fp, 'utf-8');
  const parsed = yaml.load(raw);
  const setlist = SetlistSchema.parse(parsed);
  // The history folder label is the authoritative event date. Older version
  // files may still carry a stale or missing date from before the migration.
  const labelDate = parseSetlistVersionDate(versionLabel);
  return labelDate ? { ...setlist, date: labelDate } : setlist;
}

export async function listSetlistVersions(baseId: string): Promise<SetlistVersionInfo[]> {
  const versions = await readSetlistVersions(baseId);
  const result = versions
    .map(({ label, setlist }) => {
      const date = isSetlistDate(setlist.date) ? setlist.date : undefined;
      return {
        label,
        path: label,
        title: setlist.title || baseId,
        date,
        // Prefer the folder label so old snapshots with stale YAML dates still
        // show the date they were archived under.
        eventDate: parseSetlistVersionDate(label) ?? date ?? undefined,
        description: setlist.description,
      };
    });
  // Include the current root as a history entry so an active event is never
  // missing from the timeline, unless another entry already represents it.
  const rootFilePath = path.join(getSetlistsDir(), `${baseId}.yaml`);
  if (existsSync(rootFilePath)) {
    try {
      const raw = await readFile(rootFilePath, 'utf-8');
      const current = SetlistSchema.parse(yaml.load(raw));
      const currentDate = isSetlistDate(current.date) ? current.date : undefined;
      if (currentDate) {
        const already = result.some((entry) => (entry.eventDate ?? entry.date) === currentDate);
        if (!already) {
          result.push({
            label: 'current',
            path: '',
            title: current.title || baseId,
            date: currentDate,
            eventDate: currentDate,
            description: current.description,
          });
        }
      }
    } catch {
      // Best effort: ignore an unreadable root.
    }
  }
  return result.sort((a, b) => b.label.localeCompare(a.label));
}

export interface SetlistVersionContent {
  label: string;
  title: string;
  description?: string;
  image?: string;
  date?: string;
  eventDate?: string;
  songs: SetlistItem[];
}

/** Full content of every dated version, used to prefill a new date. */
export async function listSetlistVersionContents(baseId: string): Promise<SetlistVersionContent[]> {
  const versions = await readSetlistVersions(baseId);
  return versions
    .map(({ label, setlist }) => {
      const date = isSetlistDate(setlist.date) ? setlist.date : undefined;
      return {
        label,
        title: setlist.title || baseId,
        description: setlist.description,
        image: setlist.image,
        date,
        eventDate: parseSetlistVersionDate(label) ?? date ?? undefined,
        songs: setlist.songs,
      };
    })
    .sort((a, b) => b.label.localeCompare(a.label));
}

export async function createSetlistDateVersion(
  baseId: string,
  date: string,
  copyCurrent = true,
  content?: {
    title: string;
    description?: string;
    image?: string;
    songs: SetlistItem[];
  },
): Promise<string> {
  if (!isSetlistDate(date)) throw new Error('Invalid date');
  const current = await getSetlist(baseId);
  const filePath = path.join(getSetlistsDir(), `${baseId}.yaml`);
  if (!existsSync(filePath)) throw new Error('Setlist not found');

  const existingVersions = await readSetlistVersions(baseId);

  const version: Setlist = SetlistSchema.parse({
    ...current,
    ...(content
      ? {
          title: content.title,
          description: content.description,
          image: content.image,
        }
      : {}),
    date,
    songs: content ? content.songs : copyCurrent ? current.songs : [],
    voiceShares: content ? [] : copyCurrent ? current.voiceShares : [],
    modified: new Date().toISOString(),
  });

  // Insurance: one dated entry per link and per day. A new date is only
  // allowed when it does not already exist among the archived versions with
  // different content. Identical snapshots reuse the existing entry instead.
  for (const archived of existingVersions) {
    const existingDate = isSetlistDate(archived.setlist.date)
      ? archived.setlist.date
      : parseSetlistVersionDate(archived.label);
    if (existingDate !== date) continue;
    if (setlistContentKey(archived.setlist) !== setlistContentKey(version)) {
      throw new Error('A history entry already exists for this date');
    }
  }

  // The current root itself already occupies this date; do not create a
  // duplicate dated snapshot for the same day.
  if (isSetlistDate(current.date) && current.date === date) {
    throw new Error('A history entry already exists for this date');
  }

  const existing = await findVersionWithKey(baseId, setlistContentKey(version));
  if (existing) return existing;

  const label = await uniqueVersionLabel(baseId, date);
  const versionDir = path.join(getSetlistsDir(), baseId, label);
  await mkdir(versionDir, { recursive: true });
  await writeFile(
    path.join(versionDir, 'setlist.yaml'),
    yaml.dump(version, { lineWidth: -1 }),
    'utf-8',
  );

  // The current setlist is always the most recent dated version. A date that
  // is later than the current one becomes current; older dates leave it as is.
  if (label === date && (!isSetlistDate(current.date) || date > current.date)) {
    const rootRaw = await readFile(filePath, 'utf-8');
    const root = SetlistSchema.parse(yaml.load(rootRaw));
    await writeFile(
      filePath,
      yaml.dump({ ...root, date, modified: new Date().toISOString() }, { lineWidth: -1 }),
      'utf-8',
    );
  }
  return label;
}

export async function getSong(id: string): Promise<SongMeta> {
  const songPath = await findSongPath(id);
  if (!songPath) throw new Error(`Song not found: ${id}`);
  const metaPath = path.join(songPath, 'meta.yaml');
  const raw = await readFile(metaPath, 'utf-8');
  const parsed = yaml.load(raw);
  return SongMetaSchema.parse(parsed);
}

export async function getSongTranslation(
  id: string,
  lang: string
): Promise<{ meta: SongTranslationFrontmatter; body: string; capo: number | null; key: string | null }> {
  const songPath = await findSongPath(id);
  if (!songPath) throw new Error(`Song not found: ${id}`);
  const filePath = path.join(songPath, `${toFileCode(lang)}.cho`);
  const raw = await readFile(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const meta = SongTranslationFrontmatterSchema.parse(data);
  return { 
    meta, 
    body: content.trim(), 
    capo: extractBodyCapo(content),
    key: extractBodyKey(content)
  };
}

/**
 * Get the song body for display, stripping chords if not published for the given role.
 * @param id - Song ID
 * @param lang - Language code
 * @param role - User role ('public', 'reviewer', 'admin', 'setlist_creator')
 * @returns The song body (with or without chords)
 */
export async function getSongBody(
  id: string,
  lang: string,
  role: 'public' | 'reviewer' | 'admin' | 'setlist_creator' = 'public'
): Promise<string> {
  const { meta, body } = await getSongTranslation(id, lang);
  
  // Admins and reviewers always see full content with chords
  if (role === 'admin' || role === 'reviewer') {
    return body;
  }
  
  // For public and setlist_creator, check if chords are published
  if (meta.chordsPublished) {
    return body;
  }
  
  // Strip chords for lyrics-only view
  const { stripChords } = await import('@/lib/chordpro');
  return stripChords(body);
}

/**
 * Whether the translation of a song is published.
 *
 * A translation is published when its frontmatter says so. A file that
 * cannot be read counts as not published.
 */
async function isPublishedTranslation(songPath: string, lang: string): Promise<boolean> {
  try {
    const raw = await readFile(path.join(songPath, `${toFileCode(lang)}.cho`), 'utf-8');
    const { data } = matter(raw);
    return data?.published === true;
  } catch {
    return false;
  }
}

async function isChordsPublishedTranslation(songPath: string, lang: string): Promise<boolean> {
  try {
    const raw = await readFile(path.join(songPath, `${toFileCode(lang)}.cho`), 'utf-8');
    const { data } = matter(raw);
    return data?.chordsPublished === true;
  } catch {
    return false;
  }
}

/**
 * The languages of a song.
 *
 * On the read-only (public) instance a draft translation does not exist as
 * far as the visitors are concerned — the song page answers 404 for it — so
 * the drafts are left out of the list here as well. Otherwise the pages
 * would announce a language that cannot be opened.
 */
export async function getSongTranslations(id: string): Promise<string[]> {
  const songPath = await findSongPath(id);
  if (!songPath) return [];
  const entries = await readdir(songPath);
  const translations = entries
    .filter((f) => f.endsWith('.cho'))
    .map((f) => toAppCode(path.basename(f, '.cho')));
  if (!isReadOnly()) return translations;

  const published: string[] = [];
  for (const lang of translations) {
    if (await isPublishedTranslation(songPath, lang)) published.push(lang);
  }
  return published;
}

export async function saveSongTranslation(
  id: string,
  lang: string,
  frontmatter: SongTranslationFrontmatter,
  body: string,
  albumId?: string
): Promise<void> {
  const validated = SongTranslationFrontmatterSchema.parse(frontmatter);

  let songPath = await findSongPath(id);
  if (!songPath && albumId) {
    // Song doesn't exist yet — create in the specified album
    songPath = path.join(getLibraryDir(), albumId, id);
    await mkdir(songPath, { recursive: true });
  }
  if (!songPath) throw new Error(`Song not found: ${id}`);

  // Save revision of current version before overwriting
  const filePath = path.join(songPath, `${toFileCode(lang)}.cho`);
  if (existsSync(filePath)) {
    await saveRevision(id, lang, filePath);
  }

  // Update lastModified
  const updatedFrontmatter = { ...validated, lastModified: new Date().toISOString() };

  const content = matter.stringify(body, updatedFrontmatter as Record<string, unknown>);
  await writeFile(filePath, content, 'utf-8');

  // Sync .cho and lyrics-only .txt to music directory
  await syncSongToMusicDir(id, lang, body).catch((err) => {
    console.warn(`Failed to sync song to music dir: ${id}/${lang}`, err);
  });
}

export async function addSongTranslation(
  id: string,
  lang: string,
  albumId?: string
): Promise<void> {
  let songPath = await findSongPath(id);
  if (!songPath && albumId) {
    songPath = path.join(getLibraryDir(), albumId, id);
    await mkdir(songPath, { recursive: true });
  }
  if (!songPath) throw new Error(`Song not found: ${id}`);

  if (existsSync(path.join(songPath, `${toFileCode(lang)}.cho`))) {
    throw new Error('TRANSLATION_EXISTS');
  }

  const meta = await getSong(id);
  const title = (meta.titles?.[lang] ?? meta.titles?.[toFileCode(lang)] ?? meta.title);
  const frontmatter: SongTranslationFrontmatter = {
    language: lang,
    translator: null,
    status: 'draft',
    published: false,
    chordsPublished: false,
  };
  const body = `{title: ${title}}\n`;
  await saveSongTranslation(id, lang, frontmatter, body, albumId);
}

export async function deleteSongTranslation(id: string, lang: string): Promise<string[]> {
  const songPath = await findSongPath(id);
  if (!songPath) throw new Error(`Song not found: ${id}`);

  const current = await getSongTranslations(id);
  const remaining = current.filter((l) => l !== lang);
  if (remaining.length === 0) throw new Error('LAST_TRANSLATION');
  if (remaining.length === current.length) {
    // Translation doesn't exist — nothing to remove
    return remaining;
  }

  const filePath = path.join(songPath, `${toFileCode(lang)}.cho`);
  await saveRevision(id, lang, filePath);
  await rm(filePath);
  return remaining;
}

export async function saveSongMeta(id: string, meta: SongMeta, albumId?: string): Promise<void> {
  const validated = SongMetaSchema.parse(meta);

  let songPath = await findSongPath(id);
  if (!songPath && albumId) {
    songPath = path.join(getLibraryDir(), albumId, id);
    await mkdir(songPath, { recursive: true });
  }
  if (!songPath) throw new Error(`Song not found: ${id}`);

  const metaPath = path.join(songPath, 'meta.yaml');
  const content = yaml.dump(validated, { lineWidth: -1 });
  await writeFile(metaPath, content, 'utf-8');
}

export async function createSong(
  id: string,
  title: string,
  lang: string,
  albumId?: string,
  body?: string
): Promise<void> {
  if (!albumId) {
    // Default to "No Album" — the folder lives in library/no-album/ and is not
    // registered in any album.yaml until the user explicitly assigns an album.
    albumId = NO_ALBUM_ID;
  }

  const songDir = path.join(getLibraryDir(), albumId, id);
  await mkdir(songDir, { recursive: true });

  const meta: SongMeta = {
    id,
    title,
    titles: { [lang]: title },
    tags: [],
    references: [],
    audioFiles: [],
    partitions: [],
  };
  await saveSongMeta(id, meta, albumId);

  const frontmatter: SongTranslationFrontmatter = {
    language: lang,
    translator: null,
    status: 'draft',
    published: false,
    chordsPublished: false,
  };
  // Callers that already have the ChordPro (e.g. document importers) pass it in
  // so the placeholder body never has to be written and snapshotted as a revision.
  const content = body?.trim() ? body.trim() : `{title: ${title}}\n`;
  await saveSongTranslation(id, lang, frontmatter, content, albumId);
}

export async function getLanguagesConfig(): Promise<LanguagesConfig> {
  const envLanguages = process.env.LANGUAGES;
  const languages = envLanguages
    ? envLanguages.split(',').map(s => s.trim()).filter(Boolean)
    : [...FALLBACK_LANGUAGES];
  return LanguagesConfigSchema.parse({
    languages,
    default: process.env.LANGUAGES_DEFAULT || languages[0] || 'en-US',
  });
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const filePath = path.join(getConfigDir(), 'site.yaml');
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    const defaults: Record<string, unknown> = {
      title: 'Songbook',
      defaultLanguage: 'en-US',
      pdfPageSize: 'A4',
      enableArtistPages: true,
    };
    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, yaml.dump(defaults), 'utf-8');
    } catch {
      // Read-only filesystem (e.g. public instance): keep in-memory defaults.
    }
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      raw = yaml.dump(defaults);
    }
  }
  const parsed = yaml.load(raw) as Record<string, unknown>;

  // Build / override OIDC config from env vars.
  // Setting OIDC_ISSUER is the trigger — if present, OIDC is enabled.
  const envIssuer = process.env.OIDC_ISSUER;
  if (envIssuer) {
    const yamlOidc = (parsed.oidc ?? {}) as Record<string, unknown>;

    // Build role mapping from env vars, falling back to site.yaml values
    const roleMapping: Record<string, unknown> = {
      ...(yamlOidc.roleMapping as Record<string, unknown> | undefined),
    };
    if (process.env.OIDC_ROLE_ADMIN) roleMapping.admin = process.env.OIDC_ROLE_ADMIN;
    if (process.env.OIDC_ROLE_REVIEWER) roleMapping.reviewer = process.env.OIDC_ROLE_REVIEWER;

    parsed.oidc = {
      ...yamlOidc,
      enabled: true,
      issuer: envIssuer,
      ...(process.env.OIDC_CLIENT_ID && { clientId: process.env.OIDC_CLIENT_ID }),
      ...(process.env.OIDC_SCOPES && { scopes: process.env.OIDC_SCOPES.split(/[\s,]+/).filter(Boolean) }),
      ...(process.env.OIDC_ROLE_CLAIM && { roleClaim: process.env.OIDC_ROLE_CLAIM }),
      ...(Object.keys(roleMapping).length > 0 && { roleMapping }),
      ...(process.env.OIDC_DEFAULT_ROLE && { defaultRole: process.env.OIDC_DEFAULT_ROLE }),
      ...(process.env.OIDC_BUTTON_LABEL && { buttonLabel: process.env.OIDC_BUTTON_LABEL }),
      ...(process.env.OIDC_AUTO_REDIRECT && { autoRedirect: process.env.OIDC_AUTO_REDIRECT === 'true' }),
      ...(process.env.OIDC_LOGOUT_URL && { logoutUrl: process.env.OIDC_LOGOUT_URL }),
    };
  }

  return SiteConfigSchema.parse(parsed);
}

/**
 * Base URL used for setlist share links, pointing at the read-only/public
 * instance so shared links never require a login. Resolved from the
 * `SONGBOOK_PUBLIC_URL` env var, then `site.yaml` `publicUrl`. Returns null
 * when unset (the caller falls back to the current request origin).
 */
export async function getShareBaseUrl(): Promise<string | null> {
  if (process.env.SONGBOOK_PUBLIC_URL) {
    return process.env.SONGBOOK_PUBLIC_URL.replace(/\/+$/, '');
  }
  const config = await getSiteConfig().catch(() => null);
  if (config?.publicUrl) return config.publicUrl.replace(/\/+$/, '');
  return null;
}

// --- Albums ---
// Albums live at: content/library/<album-id>/album.yaml
// Songs are subfolders: content/library/<album-id>/<song-id>/

export interface ListAlbumsOptions {
  /** If true, only include albums that have published=true. */
  onlyPublished?: boolean;
  /** Role of the requesting user. If 'admin', all albums are returned regardless of published status. */
  role?: 'public' | 'reviewer' | 'admin' | 'setlist_creator';
  /** Language to filter by for published status. If provided, only albums with at least one song published in this language are included. */
  lang?: string;
}

export async function listAlbums(options: ListAlbumsOptions = {}): Promise<Album[]> {
  const { onlyPublished = false, role, lang } = options;
  const libDir = getLibraryDir();
  const albums: Album[] = [];

  // Pre-load all songs to check published status
  const songs = await listSongs({ onlyPublished: false, role: 'admin' });
  const songPublishedMap = new Map<string, boolean>();
  for (const song of songs) {
    // Check published status per language if lang is provided
    let hasPublished = false;
    if (lang) {
      hasPublished = song.published ? song.published[lang] === true : false;
    } else {
      hasPublished = song.published ? Object.values(song.published).some(v => v === true) : false;
    }
    songPublishedMap.set(song.id, hasPublished);
  }

  try {
    const entries = await readdir(libDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const albumPath = path.join(libDir, entry.name, 'album.yaml');
        const raw = await readFile(albumPath, 'utf-8');
        const parsed = yaml.load(raw);
        const album = AlbumSchema.parse(parsed);
        
        // Compute published status: album is published if it has at least one published song
        const hasPublishedSong = album.songs.some(songId => songPublishedMap.get(songId) === true);
        const computedPublished = hasPublishedSong;
        
        // Filter based on published status and role
        if (onlyPublished && role !== 'admin' && !computedPublished) {
          continue;
        }
        
        // Add computed published status to album
        albums.push({ ...album, published: computedPublished });
      } catch {
        // skip folders without album.yaml
      }
    }
  } catch {
    // library dir doesn't exist yet
  }

  return albums;
}

export async function getAlbum(id: string): Promise<Album> {
  const albumPath = path.join(getLibraryDir(), id, 'album.yaml');
  const raw = await readFile(albumPath, 'utf-8');
  const parsed = yaml.load(raw);
  return AlbumSchema.parse(parsed);
}

export async function saveAlbum(album: Album): Promise<void> {
  const validated = AlbumSchema.parse(album);
  const albumDir = path.join(getLibraryDir(), validated.id);
  await mkdir(albumDir, { recursive: true });
  const filePath = path.join(albumDir, 'album.yaml');
  const content = yaml.dump(validated, { lineWidth: -1 });
  await writeFile(filePath, content, 'utf-8');
}

export async function createAlbum(
  id: string,
  title: string,
  artist: string,
  year?: number,
  number?: number
): Promise<void> {
  await ensureVariousArtists();
  const album: Album = {
    id,
    title,
    artist: artist || 'various-artists',
    year,
    number,
    tags: [],
    songs: [],
    published: false,
  };
  await saveAlbum(album);
}

export async function getAlbumsForSong(songId: string): Promise<Album[]> {
  const albumId = await findSongAlbumId(songId);
  if (!albumId) return [];
  try {
    const album = await getAlbum(albumId);
    return [album];
  } catch {
    return [];
  }
}

export async function getArtistForSong(songId: string): Promise<Artist | null> {
  const albums = await getAlbumsForSong(songId);
  if (albums.length === 0) return null;
  try {
    return await getArtist(albums[0].artist);
  } catch {
    return null;
  }
}

// --- Artists ---
// Artists live at: content/artists/<artist-id>.yaml

export async function listArtists(): Promise<Artist[]> {
  const artistsDir = path.join(getContentDir(), 'artists');
  try {
    const entries = await readdir(artistsDir);
    const artists: Artist[] = [];

    for (const entry of entries) {
      if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;
      try {
        const filePath = path.join(artistsDir, entry);
        const raw = await readFile(filePath, 'utf-8');
        const parsed = yaml.load(raw);
        const artist = ArtistSchema.parse(parsed);
        artists.push(artist);
      } catch {
        console.warn(`Skipping artist file: ${entry}`);
      }
    }

    return artists;
  } catch {
    return [];
  }
}

export async function getArtist(id: string): Promise<Artist> {
  const filePath = path.join(getContentDir(), 'artists', `${id}.yaml`);
  const raw = await readFile(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  return ArtistSchema.parse(parsed);
}

export async function saveArtist(artist: Artist): Promise<void> {
  const validated = ArtistSchema.parse(artist);
  const artistsDir = path.join(getContentDir(), 'artists');
  await mkdir(artistsDir, { recursive: true });
  const filePath = path.join(artistsDir, `${validated.id}.yaml`);
  const content = yaml.dump(validated, { lineWidth: -1 });
  await writeFile(filePath, content, 'utf-8');
}

export async function getAlbumsForArtist(artistId: string): Promise<Album[]> {
  const albums = await listAlbums();
  return albums.filter((album) => album.artist === artistId);
}

// --- Delete operations ---

export async function deleteArtist(id: string): Promise<void> {
  const filePath = path.join(getContentDir(), 'artists', `${id}.yaml`);
  await rm(filePath);
}

export async function deleteAlbum(id: string): Promise<void> {
  const albumDir = path.join(getContentDir(), 'library', id);
  await rm(albumDir, { recursive: true });
}

export async function deleteSong(songId: string): Promise<void> {
  const libDir = path.join(getContentDir(), 'library');
  const albumDirs = await readdir(libDir, { withFileTypes: true });
  for (const albumDir of albumDirs) {
    if (!albumDir.isDirectory()) continue;
    const songDir = path.join(libDir, albumDir.name, songId);
    if (existsSync(songDir)) {
      await rm(songDir, { recursive: true });
      // Also remove from album.yaml songs list
      try {
        const album = await getAlbum(albumDir.name);
        album.songs = album.songs.filter((s: string) => s !== songId);
        await saveAlbum(album);
      } catch {}
      return;
    }
  }
}

// --- Rename operations ---

/**
 * Change a song's ID. The song directory is renamed, the meta.yaml `id` is
 * kept in sync, and every reference to the old ID is updated: the parent
 * album's `songs` list and any setlist `songs[].songId`. All per-language
 * `.cho` files move with the directory, and the revision snapshots are
 * renamed in `content/revisions/`, so the song keeps its history.
 */
export async function renameSong(oldId: string, newId: string): Promise<string | null> {
  if (!oldId || !newId) throw new Error('Song ID is required');
  if (oldId === newId) throw new Error('New ID is the same as the current ID');
  if (newId.includes('/') || newId.includes('\\') || newId.includes('..')) {
    throw new Error('Invalid song ID');
  }

  const albumId = await findSongAlbumId(oldId);
  if (!albumId) throw new Error(`Song not found: ${oldId}`);
  if (await findSongPath(newId)) throw new Error(`A song with ID "${newId}" already exists`);

  const oldDir = path.join(getLibraryDir(), albumId, oldId);
  const newDir = path.join(getLibraryDir(), albumId, newId);
  await rename(oldDir, newDir);

  // The revision snapshots live outside the library, keyed by song id —
  // they have to be renamed separately.
  try {
    await moveRevisions(oldId, newId);
  } catch (err) {
    console.error(`renameSong: failed to move revisions from ${oldId} to ${newId}`, err);
  }

  // Keep meta.yaml `id` in sync with the new directory name
  const meta = await getSong(newId);
  meta.id = newId;
  await saveSongMeta(newId, meta);

  // Update the album's songs list (skip the "no album" pseudo-album)
  if (albumId !== NO_ALBUM_ID) {
    try {
      const album = await getAlbum(albumId);
      if (album.songs.includes(oldId)) {
        album.songs = album.songs.map((s: string) => (s === oldId ? newId : s));
        await saveAlbum(album);
      }
    } catch (err) {
      console.error(`renameSong: failed to update album ${albumId} songs list`, err);
    }
  }

  // Update any setlists referencing the song
  try {
    const setlists = await listSetlists();
    for (const setlist of setlists) {
      if (!setlist.songs.some((s) => s.type === 'song' && s.songId === oldId)) continue;
      setlist.songs = setlist.songs.map((s) =>
        s.type === 'song' && s.songId === oldId ? { ...s, songId: newId } : s,
      );
      await saveSetlist(setlist);
    }
  } catch (err) {
    console.error(`renameSong: failed to update setlists for ${oldId}`, err);
  }

  return albumId;
}

/**
 * Change an album's ID. The album directory is renamed, the album.yaml `id` is
 * kept in sync, and every reference to the old ID is updated: songs in that
 * album's folder keep their paths but references in other contexts (setlists
 * that might reference songs by album - but songs already have their own paths;
 * primarily need to update any references if they exist). Also update the
 * album's id in its own file and move the directory.
 */
export async function renameAlbum(oldId: string, newId: string): Promise<void> {
  if (!oldId || !newId) throw new Error('Album ID is required');
  if (oldId === newId) throw new Error('New ID is the same as the current ID');
  if (newId.includes('/') || newId.includes('\\') || newId.includes('..')) {
    throw new Error('Invalid album ID');
  }
  if (oldId === NO_ALBUM_ID || newId === NO_ALBUM_ID) {
    throw new Error('Cannot rename the "no-album" pseudo-album');
  }

  const oldDir = path.join(getLibraryDir(), oldId);
  const newDir = path.join(getLibraryDir(), newId);
  if (!existsSync(oldDir)) throw new Error(`Album not found: ${oldId}`);
  if (existsSync(newDir)) throw new Error(`An album with ID "${newId}" already exists`);

  await rename(oldDir, newDir);

  const album = await getAlbum(newId);
  album.id = newId;
  await saveAlbum(album);

  // Update songs that reference this album? No, songs live in the album folder;
  // their own album association is implicit via path. But also update setlists
  // that might reference album contexts - not applicable. Just need to ensure
  // all internal references are consistent.
}

/**
 * Move a song into a different album. The song folder is physically moved to
 * the target album's directory (carrying the per-language `.cho` files with
 * it), the song is removed from the old album's `songs` list and added to
 * the new one. The revision snapshots live in `content/revisions/<song-id>/`
 * and are keyed by song id, so they stay where they are.
 *
 * `NO_ALBUM_ID` (the "No Album" pseudo-album) is special: songs assigned there
 * live in `content/library/no-album/<song-id>/` and are NOT registered in any
 * `album.yaml`. Moving to "No Album" drops the song from its real album;
 * moving out of "No Album" into a real album registers it. Picking "No Album"
 * is the default for newly created songs.
 */
export async function changeSongAlbum(
  songId: string,
  newAlbumId: string
): Promise<string | null> {
  if (!songId || !newAlbumId) throw new Error('Album ID is required');
  if (newAlbumId.includes('/') || newAlbumId.includes('\\') || newAlbumId.includes('..')) {
    throw new Error('Invalid album ID');
  }

  const songPath = await findSongPath(songId);
  if (!songPath) throw new Error(`Song not found: ${songId}`);
  const oldAlbumId = await findSongAlbumId(songId);
  // Throws if the target album does not exist (unless it's the "No Album" pseudo-album)
  if (newAlbumId !== NO_ALBUM_ID) {
    await getAlbum(newAlbumId);
  }

  if (oldAlbumId === newAlbumId) return oldAlbumId;

  const targetSongDir = path.join(getLibraryDir(), newAlbumId, songId);
  await mkdir(path.dirname(targetSongDir), { recursive: true });
  await rename(songPath, targetSongDir);

  // Drop the song from the old album's songs list
  if (oldAlbumId && oldAlbumId !== NO_ALBUM_ID) {
    try {
      const album = await getAlbum(oldAlbumId);
      if (album.songs.includes(songId)) {
        album.songs = album.songs.filter((s: string) => s !== songId);
        await saveAlbum(album);
      }
    } catch (err) {
      console.error(`changeSongAlbum: failed to update old album ${oldAlbumId}`, err);
    }
  }

  // Add the song to the new album's songs list (skip "No Album")
  if (newAlbumId !== NO_ALBUM_ID) {
    try {
      const album = await getAlbum(newAlbumId);
      if (!album.songs.includes(songId)) {
        album.songs.push(songId);
        await saveAlbum(album);
      }
    } catch (err) {
      console.error(`changeSongAlbum: failed to update new album ${newAlbumId}`, err);
    }
  }

  return oldAlbumId;
}

/**
 * Ensure every song that has just been (re)assigned to an album's `songs`
 * list physically lives inside that album's directory. Songs still parked in
 * the "No Album" folder are moved into `library/<albumId>/<songId>`. This
 * keeps folder location and album membership consistent when songs are added
 * through the album editor. Returns the number of folders moved.
 */
export async function moveNoAlbumSongsIntoAlbum(
  albumId: string,
  songIds: string[]
): Promise<number> {
  if (!albumId || songIds.length === 0) return 0;
  try {
    await getAlbum(albumId);
  } catch {
    return 0;
  }

  let moved = 0;
  for (const songId of songIds) {
    const songPath = await findSongPath(songId);
    if (!songPath) continue;
    if (path.basename(path.dirname(songPath)) !== NO_ALBUM_ID) continue;
    const target = path.join(getLibraryDir(), albumId, songId);
    if (path.normalize(songPath) === path.normalize(target)) continue;
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await rename(songPath, target);
      moved++;
    } catch (err) {
      console.error(`moveNoAlbumSongsIntoAlbum: failed to move ${songId} to ${albumId}`, err);
    }
  }
  return moved;
}

export {
  listRevisions,
  getRevision,
  saveRevision,
  moveRevisions,
  getRevisionsRoot,
  getRevisionsDir,
  timestampToRevisionFile,
  revisionFileToTimestamp,
  collectRevisions,
  collectAllRevisions,
  getRevisionGCConfig,
  DEFAULT_REVISIONS_MAX_COUNT,
  DEFAULT_REVISIONS_MAX_AGE_DAYS,
  type RevisionGCConfig,
  type RevisionGCOptions,
  type RevisionCollectionResult,
} from './revisions';

export interface PublicationLanguageStatus {
  present: boolean;
  published: boolean;
  chordsPublished: boolean;
}

export interface PublicationStatusRow {
  songId: string;
  title: string;
  languages: Record<string, PublicationLanguageStatus>;
}

export interface PublicationStatusResult {
  languages: string[];
  defaultLanguage: string;
  rows: PublicationStatusRow[];
}

export async function getPublicationStatus(options?: {
  role?: 'public' | 'reviewer' | 'admin' | 'setlist_creator';
}): Promise<PublicationStatusResult> {
  const role = options?.role ?? 'admin';
  const [langConfig, songs] = await Promise.all([
    getLanguagesConfig(),
    listSongs({ onlyPublished: false, role }),
  ]);
  const languages = langConfig.languages;
  const rows = songs
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((song) => {
      const languagesMap: Record<string, PublicationLanguageStatus> = {};
      for (const lang of languages) {
        const present = (song.translations ?? []).includes(lang);
        languagesMap[lang] = {
          present,
          published: present && song.published?.[lang] === true,
          chordsPublished: present && song.chordsPublished?.[lang] === true,
        };
      }
      return {
        songId: song.id,
        title: song.title,
        languages: languagesMap,
      };
    });
  return { languages, defaultLanguage: langConfig.default, rows };
}

export const collectPublicationStatus = getPublicationStatus;
export const collectPublication = getPublicationStatus;
export const getPublication = getPublicationStatus;
export const getPublicationMatrix = getPublicationStatus;
export const getPublicationReport = getPublicationStatus;
export const getPublishStatus = getPublicationStatus;
export const getPublicationStats = getPublicationStatus;
