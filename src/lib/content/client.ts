"use client";

import { isReadOnly } from '@/lib/readonly';
import { resolveSongListTitle } from '@/lib/song-titles';
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
  type SetlistInput,
} from './schemas';

export type {
  SongMeta,
  SongTranslationFrontmatter,
  LanguagesConfig,
  SiteConfig,
  Album,
  Artist,
  Setlist,
  SetlistInput,
};

/**
 * Client-safe type for read-only setlist songs.
 */
export interface SetlistReadOnlySong {
  songId: string;
  lang: string;
  title: string;
  key?: string;
  translations: string[];
  published?: boolean;
  body?: string;
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
 * Resolve the localized title for a song meta in a given language.
 * Falls back to the song's default title when no language-specific title exists.
 */
export function resolveLocalizedTitle(meta: SongMeta, lang: string): string {
  return meta.titles?.[lang] || meta.title;
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
 * Resolve the localized title for a song in a given language.
 * This is a server-side function that reads from the filesystem.
 * For client-side use, use the title from the song data passed as props.
 */
export async function getSongTitle(songId: string, lang: string): Promise<string> {
  // This is a server-side function - client components should receive the title as a prop
  throw new Error('getSongTitle is a server-only function. Use the title from song data passed as props.');
}

/**
 * Get the localized title for an album in a given language.
 * Server-side only.
 */
export async function getAlbumTitle(albumId: string, lang: string): Promise<string> {
  throw new Error('getAlbumTitle is a server-only function. Use the title from album data passed as props.');
}