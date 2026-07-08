import { readdir, readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import * as yaml from 'js-yaml';
import { saveRevision } from './revisions';
import {
  SongMetaSchema,
  SongTranslationFrontmatterSchema,
  LanguagesConfigSchema,
  SiteConfigSchema,
  AlbumSchema,
  ArtistSchema,
  type SongMeta,
  type SongTranslationFrontmatter,
  type LanguagesConfig,
  type SiteConfig,
  type Album,
  type Artist,
} from './schemas';

export function getContentDir(): string {
  return path.join(process.cwd(), 'content');
}

function getLibraryDir(): string {
  return path.join(getContentDir(), 'library');
}

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

export async function listSongs(): Promise<SongMeta[]> {
  const libDir = getLibraryDir();
  const songs: SongMeta[] = [];

  try {
    const albumDirs = await readdir(libDir, { withFileTypes: true });
    for (const albumDir of albumDirs) {
      if (!albumDir.isDirectory()) continue;
      const albumPath = path.join(libDir, albumDir.name);
      const entries = await readdir(albumPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const metaPath = path.join(albumPath, entry.name, 'meta.yaml');
          const raw = await readFile(metaPath, 'utf-8');
          const parsed = yaml.load(raw);
          const meta = SongMetaSchema.parse(parsed);
          songs.push(meta);
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
): Promise<{ meta: SongTranslationFrontmatter; body: string }> {
  const songPath = await findSongPath(id);
  if (!songPath) throw new Error(`Song not found: ${id}`);
  const filePath = path.join(songPath, `${lang}.cho`);
  const raw = await readFile(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const meta = SongTranslationFrontmatterSchema.parse(data);
  return { meta, body: content.trim() };
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
  albumId?: string
): Promise<void> {
  if (!albumId) {
    // Must have an album — find or use first available
    const albums = await listAlbums();
    if (albums.length > 0) {
      albumId = albums[0].id;
    } else {
      throw new Error('No albums exist. Create an album first.');
    }
  }

  const songDir = path.join(getLibraryDir(), albumId, id);
  await mkdir(songDir, { recursive: true });

  const meta: SongMeta = {
    id,
    title,
    tags: [],
    references: [],
  };
  await saveSongMeta(id, meta, albumId);

  const frontmatter: SongTranslationFrontmatter = {
    language: lang,
    translator: null,
    status: 'draft',
    published: false,
  };
  const body = `{title: ${title}}\n`;
  await saveSongTranslation(id, lang, frontmatter, body, albumId);
}

export async function getLanguagesConfig(): Promise<LanguagesConfig> {
  const filePath = path.join(getContentDir(), 'config', 'languages.yaml');
  const raw = await readFile(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  return LanguagesConfigSchema.parse(parsed);
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const filePath = path.join(getContentDir(), 'config', 'site.yaml');
  const raw = await readFile(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  return SiteConfigSchema.parse(parsed);
}

// --- Albums ---
// Albums live at: content/library/<album-id>/album.yaml
// Songs are subfolders: content/library/<album-id>/<song-id>/

export async function listAlbums(): Promise<Album[]> {
  const libDir = getLibraryDir();
  const albums: Album[] = [];

  try {
    const entries = await readdir(libDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const albumPath = path.join(libDir, entry.name, 'album.yaml');
        const raw = await readFile(albumPath, 'utf-8');
        const parsed = yaml.load(raw);
        const album = AlbumSchema.parse(parsed);
        albums.push(album);
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
  year?: number
): Promise<void> {
  await ensureVariousArtists();
  const album: Album = {
    id,
    title,
    artist: artist || 'various-artists',
    year,
    tags: [],
    songs: [],
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
