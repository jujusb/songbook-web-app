import { readdir, readFile, writeFile, mkdir, rm, rename } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import * as yaml from 'js-yaml';
import { saveRevision } from './revisions';
import { syncSongToMusicDir } from '@/lib/lyrics-sync';
import { FALLBACK_LANGUAGES } from '@/lib/i18n/labels';
export { resolveSongListTitle } from '../song-titles';
import {
  SongMetaSchema,
  SongTranslationFrontmatterSchema,
  LanguagesConfigSchema,
  SiteConfigSchema,
  AlbumSchema,
  ArtistSchema,
  SetlistSchema,
  type SongMeta,
  type SongTranslationFrontmatter,
  type LanguagesConfig,
  type SiteConfig,
  type Album,
  type Artist,
  type Setlist,
} from './schemas';

export function getContentDir(): string {
  return path.join(process.cwd(), 'content');
}

function getLibraryDir(): string {
  return path.join(getContentDir(), 'library');
}

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

// --- Helper: find which album folder a song lives in ---

async function findSongPath(songId: string): Promise<string | null> {
  const libDir = getLibraryDir();
  try {
    const albumDirs = await readdir(libDir, { withFileTypes: true });
    for (const albumDir of albumDirs) {
      if (!albumDir.isDirectory()) continue;
      const songDir = path.join(libDir, albumDir.name, songId);
      if (existsSync(songDir)) {
        return songDir;
      }
    }
  } catch {
    // library dir doesn't exist
  }
  return null;
}

async function findSongAlbumId(songId: string): Promise<string | null> {
  const libDir = getLibraryDir();
  try {
    const albumDirs = await readdir(libDir, { withFileTypes: true });
    for (const albumDir of albumDirs) {
      if (!albumDir.isDirectory()) continue;
      const songDir = path.join(libDir, albumDir.name, songId);
      if (existsSync(songDir)) {
        return albumDir.name;
      }
    }
  } catch {}
  return null;
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
};

export interface ListSongsOptions {
  /** If true, only include songs that have at least one published translation.
   *  If false (default), include all songs. */
  onlyPublished?: boolean;
  /** Role of the requesting user. If 'admin', all songs are returned regardless of published status. */
  role?: 'public' | 'reviewer' | 'admin';
}

export async function listSongs(options: ListSongsOptions = {}): Promise<SongListItem[]> {
  const { onlyPublished = false, role } = options;
  const libDir = getLibraryDir();
  const songs: SongListItem[] = [];
  const langConfig = await getLanguagesConfig().catch(() => null);
  const defaultLang = langConfig?.default ?? 'en';

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
          try {
            const files = await readdir(songPath);
            translations = files
              .filter((f) => f.endsWith('.cho'))
              .map((f) => path.basename(f, '.cho'));
            // Read published status from each translation
            for (const lang of translations) {
              try {
                const choRaw = await readFile(path.join(songPath, `${lang}.cho`), 'utf-8');
                const { data } = matter(choRaw);
                publishedMap[lang] = data?.published === true;
              } catch {
                publishedMap[lang] = false;
              }
            }
          } catch {
            // no .cho files readable
          }
          const choTitles: Record<string, string> = {};
          for (const lang of translations) {
            if (lang === defaultLang) continue;
            if (meta.titles?.[lang]) continue;
            try {
              const choRaw = await readFile(path.join(songPath, `${lang}.cho`), 'utf-8');
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
          // Filter based on role and published status
          if (onlyPublished && role !== 'admin' && !hasPublished) {
            continue; // skip unpublished songs for non-admin
          }
          songs.push({ ...meta, translations, choTitles, published: publishedMap });
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
 * Resolve the localized title for a song meta in a given language.
 * Falls back to the song's default title when no language-specific title exists.
 */
export function resolveLocalizedTitle(meta: SongMeta, lang: string): string {
  return meta.titles?.[lang] || meta.title;
}

/**
 * Decide whether a song should appear in a list for the selected language.
 * When the selected language is the site's default language, every song is
 * shown; otherwise only songs that actually have that translation.
 */
export function shouldShowSongInLanguage(
  translations: string[],
  selectedLang: string,
  defaultLang: string
): boolean {
  if (!selectedLang || selectedLang === defaultLang) return true;
  return translations.includes(selectedLang);
}

/**
 * Extract the {title: ...} directive value from a ChordPro body, if present.
 */
export function extractBodyTitle(body: string): string | null {
  const match = body.match(/\{title:\s*([^}\n\r]+)\}/i);
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
    if (meta.titles?.[lang]) return meta.titles[lang];
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
    return album.titles?.[lang] || album.title;
  } catch {
    return albumId;
  }
}

// --- Setlists ---
// Setlists live at: content/setlists/<setlist-id>.yaml

function getSetlistsDir(): string {
  return path.join(getContentDir(), 'setlists');
}

export async function listSetlists(): Promise<Setlist[]> {
  const dir = getSetlistsDir();
  try {
    const entries = await readdir(dir);
    const setlists: Setlist[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;
      try {
        const raw = await readFile(path.join(dir, entry), 'utf-8');
        const parsed = yaml.load(raw);
        setlists.push(SetlistSchema.parse(parsed));
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
  return SetlistSchema.parse(parsed);
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

export async function saveSetlist(setlist: Setlist): Promise<void> {
  const validated = SetlistSchema.parse(setlist);
  const dir = getSetlistsDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${validated.id}.yaml`);
  const content = yaml.dump(
    { ...validated, modified: new Date().toISOString() },
    { lineWidth: -1 }
  );
  await writeFile(filePath, content, 'utf-8');
}

export async function deleteSetlist(id: string): Promise<void> {
  const filePath = path.join(getSetlistsDir(), `${id}.yaml`);
  await rm(filePath);
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
  const filePath = path.join(songPath, `${lang}.cho`);
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

export async function getSongTranslations(id: string): Promise<string[]> {
  const songPath = await findSongPath(id);
  if (!songPath) return [];
  const entries = await readdir(songPath);
  return entries
    .filter((f) => f.endsWith('.cho'))
    .map((f) => path.basename(f, '.cho'));
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
  if (existsSync(path.join(songPath, `${lang}.cho`))) {
    await saveRevision(songPath, lang);
  }

  // Update lastModified
  const updatedFrontmatter = { ...validated, lastModified: new Date().toISOString() };

  const filePath = path.join(songPath, `${lang}.cho`);
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

  if (existsSync(path.join(songPath, `${lang}.cho`))) {
    throw new Error('TRANSLATION_EXISTS');
  }

  const meta = await getSong(id);
  const title = meta.titles?.[lang] || meta.title;
  const frontmatter: SongTranslationFrontmatter = {
    language: lang,
    translator: null,
    status: 'draft',
    published: false,
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

  const filePath = path.join(songPath, `${lang}.cho`);
  await saveRevision(songPath, lang);
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
    default: process.env.LANGUAGES_DEFAULT || languages[0] || 'en',
  });
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const filePath = path.join(getContentDir(), 'config', 'site.yaml');
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    const defaults: Record<string, unknown> = {
      title: 'Songbook',
      defaultLanguage: 'en',
      pdfPageSize: 'A4',
      enableArtistPages: true,
    };
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, yaml.dump(defaults), 'utf-8');
    raw = await readFile(filePath, 'utf-8');
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
  role?: 'public' | 'reviewer' | 'admin';
}

export async function listAlbums(options: ListAlbumsOptions = {}): Promise<Album[]> {
  const { onlyPublished = false, role } = options;
  const libDir = getLibraryDir();
  const albums: Album[] = [];

  // Pre-load all songs to check published status
  const songs = await listSongs({ onlyPublished: false, role: 'admin' });
  const songPublishedMap = new Map<string, boolean>();
  for (const song of songs) {
    const hasPublished = song.published ? Object.values(song.published).some(v => v === true) : false;
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
 * `.cho` files and `.revisions/` snapshots move with the directory, so none
 * of the song content is touched.
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
      if (!setlist.songs.some((s) => s.songId === oldId)) continue;
      setlist.songs = setlist.songs.map((s) => (s.songId === oldId ? { ...s, songId: newId } : s));
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
 * the target album's directory (carrying the per-language `.cho` files and
 * `.revisions/` with it), the song is removed from the old album's `songs`
 * list and added to the new one.
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
