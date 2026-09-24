"use server";

import { saveSongTranslation, saveSongMeta, createSong, getSong, getSongTranslation, getSiteConfig, listArtists, extractBodyTitle, addSongTranslation, deleteSongTranslation, renameSong, changeSongAlbum, getSetlist, saveSetlist } from "@/lib/content";
import { SongTranslationFrontmatterSchema, type Reference, type AudioFile, type SongMeta, type Partition } from "@/lib/content/schemas";
import { scanMusicDir, getMusicDir, slugify, stripNumberPrefix } from "@/lib/music-importer";
import { revalidatePath } from "next/cache";
import matter from "gray-matter";
import { isReadOnly } from "@/lib/readonly";
import { getSession, canEdit } from "@/lib/auth";
import { randomUUID } from "node:crypto";

function assertWritable() {
  if (isReadOnly()) {
    throw new Error("Read-only mode");
  }
}

/**
 * Keep the song's localized title (meta.yaml `titles` map) in sync with a
 * given language title value. Empty title removes the override.
 */
async function syncSongTitle(songId: string, lang: string, title: string) {
  const meta = await getSong(songId);
  const titles = { ...(meta.titles ?? {}) };
  if (title.trim()) {
    titles[lang] = title.trim();
  } else {
    delete titles[lang];
  }

  const titlesChanged = JSON.stringify(titles) !== JSON.stringify(meta.titles ?? {});
  const siteConfig = await getSiteConfig().catch(() => null);
  const isDefaultLang = !!siteConfig && siteConfig.defaultLanguage === lang;
  const titleChanged =
    isDefaultLang && !!title.trim() && meta.title !== title.trim();

  if (titlesChanged || titleChanged) {
    await saveSongMeta(songId, {
      ...meta,
      titles,
      ...(titleChanged ? { title: title.trim() } : {}),
    });
  }
}

/** Rewrite the {title: ...} directive in a ChordPro body. */
function setBodyTitle(body: string, title: string): string {
  if (/\{title:\s*[^}]*\}/i.test(body)) {
    return body.replace(/\{title:\s*[^}]*\}/i, `{title: ${title}}`);
  }
  return `{title: ${title}}\n${body.trimStart()}`;
}

export async function setSongTitleAction(songId: string, lang: string, title: string) {
  assertWritable();
  const titleValue = title.trim();
  await syncSongTitle(songId, lang, titleValue);

  if (titleValue) {
    try {
      const { meta: frontmatter, body } = await getSongTranslation(songId, lang);
      const updatedBody = setBodyTitle(body, titleValue);
      if (updatedBody !== body) {
        await saveSongTranslation(songId, lang, frontmatter, updatedBody);
      }
    } catch (err) {
      console.warn(`Failed to sync title directive for ${songId}/${lang}`, err);
    }
  }

  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/edit/${songId}/${lang}`);
  revalidatePath("/songs");
  revalidatePath("/browse");
}

export async function saveSongAction(songId: string, lang: string, content: string) {
  assertWritable();
  // Parse the content - it may be just the ChordPro body (no frontmatter)
  // We need to preserve the original frontmatter
  let body: string;
  let frontmatter;

  try {
    const parsed = matter(content);
    if (parsed.data && parsed.data.language) {
      frontmatter = SongTranslationFrontmatterSchema.parse(parsed.data);
      body = parsed.content.trim();
    } else {
      const existing = await getSongTranslation(songId, lang);
      frontmatter = existing.meta;
      body = content.trim();
    }
  } catch {
    const existing = await getSongTranslation(songId, lang);
    frontmatter = existing.meta;
    body = content.trim();
  }

  await saveSongTranslation(songId, lang, frontmatter, body);

  // Keep the meta.yaml `titles` map in sync with the {title: ...} directive
  const bodyTitle = extractBodyTitle(body);
  if (bodyTitle) {
    await syncSongTitle(songId, lang, bodyTitle);
  }

  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/edit/${songId}/${lang}`);
}

export async function createSongAction(formData: FormData) {
  assertWritable();
  const title = formData.get("title") as string;
  const lang = (formData.get("lang") as string) || "en";

  if (!title) {
    throw new Error("Title is required");
  }

  // Generate slug from title
  const id = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await createSong(id, title, lang);
  revalidatePath("/songs");
  return { id, lang };
}

export async function saveSongReferencesAction(songId: string, references: Reference[]) {
  assertWritable();
  const meta = await getSong(songId);
  meta.references = references;
  await saveSongMeta(songId, meta);
  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/edit/${songId}/[lang]`, "page");
}

export async function changeSongIdAction(oldId: string, newId: string) {
  if (isReadOnly()) {
    return {
      ok: false as const,
      error: 'READ_ONLY',
    };
  }
  try {
    const albumId = await renameSong(oldId, newId);
    revalidatePath(`/songs/${oldId}`);
    revalidatePath(`/songs/${newId}`);
    revalidatePath(`/edit/${newId}/[lang]`, "page");
    revalidatePath("/songs");
    revalidatePath("/browse");
    if (albumId) revalidatePath(`/albums/${albumId}`);
    return { ok: true as const, songId: newId, albumId };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'FAILED',
    };
  }
}

export async function changeSongAlbumAction(songId: string, albumId: string) {
  if (isReadOnly()) {
    return {
      ok: false as const,
      error: 'READ_ONLY',
    };
  }
  try {
    const oldAlbumId = await changeSongAlbum(songId, albumId);
    revalidatePath(`/songs/${songId}`);
    revalidatePath(`/albums/${albumId}`);
    if (oldAlbumId && oldAlbumId !== albumId) revalidatePath(`/albums/${oldAlbumId}`);
    revalidatePath("/songs");
    revalidatePath("/browse");
    return { ok: true as const, songId, albumId };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'FAILED',
    };
  }
}

export async function addSongTranslationAction(songId: string, lang: string) {
  if (isReadOnly()) {
    return {
      ok: false as const,
      error: 'READ_ONLY',
    };
  }
  try {
    await addSongTranslation(songId, lang);
    revalidatePath(`/edit/${songId}/${lang}`, "page");
    revalidatePath(`/edit/${songId}/[lang]`, "page");
    revalidatePath(`/songs/${songId}`);
    revalidatePath("/songs");
    revalidatePath("/browse");
    return { ok: true as const, songId, lang };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'FAILED',
    };
  }
}

export async function removeSongTranslationAction(songId: string, lang: string, currentLang: string) {
  if (isReadOnly()) {
    return {
      ok: false as const,
      error: 'READ_ONLY',
    };
  }
  try {
    const remaining = await deleteSongTranslation(songId, lang);
    revalidatePath(`/edit/${songId}/[lang]`, "page");
    revalidatePath(`/songs/${songId}`);
    revalidatePath("/songs");
    revalidatePath("/browse");
    const nextLang = remaining.includes(currentLang) ? currentLang : remaining[0] ?? '';
    return {
      ok: true as const,
      songId,
      lang,
      remaining,
      nextLang,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'FAILED',
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Music import                                                      */
/* ------------------------------------------------------------------ */

export type { MusicScanItem, MusicScanResult, MusicLanguageGroup, MusicVoiceGroup, MusicVoiceFile } from "@/lib/music-importer";

export async function listArtistsAction() {
  try {
    return await listArtists();
  } catch {
    return [];
  }
}

export async function browseMusicDirAction(subPath?: string) {
  const { readdir } = await import("fs/promises");
  const { existsSync } = await import("fs");
  const pathMod = await import("path");
  const root = getMusicDir();
  if (!existsSync(root)) return null;

  const dirPath = subPath ? pathMod.join(root, subPath) : root;

  // Prevent path traversal
  const normalized = pathMod.resolve(dirPath);
  if (!normalized.startsWith(pathMod.resolve(root))) return null;

  try {
    const entries = await readdir(normalized, { withFileTypes: true });
    const dirs: string[] = [];
    const hasSubdirs: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      dirs.push(entry.name);
      const sub = await readdir(pathMod.join(normalized, entry.name), { withFileTypes: true });
      if (sub.some((s) => s.isDirectory())) hasSubdirs.push(entry.name);
    }
    dirs.sort();
    return { dirs, hasSubdirs };
  } catch {
    return null;
  }
}

export async function scanMusicDirectoryAction(
  configJson: string,
  songId?: string,
) {
  try {
    const config = JSON.parse(configJson) as import("@/lib/music-importer").ScanConfig;
    return await scanMusicDir(songId, config);
  } catch (err) {
    console.error("Music scan failed:", err);
    return [];
  }
}

export async function importMusicAction(songId: string, configJson?: string, artist?: string) {
  assertWritable();
  // Scan for this specific song to get its audio files
  if (!configJson) throw new Error("Scan config is required");
  const config = JSON.parse(configJson) as import("@/lib/music-importer").ScanConfig;
  const items = await scanMusicDir(songId, config);
  const item = items.find((i) => i.songId === songId);
  if (!item) throw new Error(`No music files found for song: ${songId}`);

  const audioFiles: AudioFile[] = [];

  for (const lang of item.languages) {
    for (const vg of lang.voices) {
      for (const f of vg.files) {
        const urlPath = f.path.split("/").map(encodeURIComponent).join("/");
        audioFiles.push({
          lang: lang.lang,
          voice: f.voice,
          path: `/api/music/${urlPath}`,
        });
      }
    }
  }

  if (audioFiles.length === 0) throw new Error("No audio files found");

  // Resolve album: collect all language-specific album names and create/update the album
  const albumEntries = item.languages
    .filter((l) => l.album)
    .map((l) => ({ lang: l.lang, name: l.album! }));
  let albumId: string | undefined;

  // Resolve artist — create YAML file if doesn't exist yet
  let artistId = "unknown";
  if (artist?.trim()) {
    artistId = slugify(artist.trim());
    const { getArtist, saveArtist } = await import("@/lib/content");
    try {
      await getArtist(artistId);
    } catch {
      await saveArtist({
        id: artistId,
        name: artist.trim(),
        bio: "",
        tags: [],
      });
    }
  }

  if (albumEntries.length > 0) {
    const primaryName = stripNumberPrefix(albumEntries[0].name);
    const { listAlbums, saveAlbum } = await import("@/lib/content");
    const albums = await listAlbums();
    const existing = albums.find(
      (a) => a.id === slugify(primaryName) || a.title.toLowerCase() === primaryName.toLowerCase()
    );

    // Collect all language-specific titles
    const langTitles: Record<string, string> = {};
    for (const ae of albumEntries) {
      langTitles[ae.lang] = stripNumberPrefix(ae.name);
    }

    if (existing) {
      albumId = existing.id;
      // Update titles if new language variants appeared
      const updatedTitles = { ...(existing.titles ?? {}), ...langTitles };
      // Keep the primary title matching the first language
      if (Object.keys(updatedTitles).length > (existing.titles ? Object.keys(existing.titles).length : 0)) {
        await saveAlbum({ ...existing, titles: updatedTitles });
      }
    } else {
      const cleanId = slugify(primaryName);
      albumId = cleanId;
      await saveAlbum({
        id: cleanId,
        title: primaryName,
        titles: Object.keys(langTitles).length > 1 ? langTitles : undefined,
        artist: artistId,
        tags: [],
        songs: [],
      });
    }
  } else {
    // No album name from scan — use first existing album
    const { listAlbums } = await import("@/lib/content");
    const albums = await listAlbums();
    if (albums.length > 0) {
      albumId = albums[0].id;
    }
  }

  // Update or create song
  let meta: SongMeta;
  try {
    meta = await getSong(songId);
    meta.audioFiles = audioFiles;
  } catch {
    meta = {
      id: songId,
      title: item.title,
      tags: [],
      references: [],
      audioFiles,
      partitions: [],
    };
  }

  // Collect per-language titles from the scan
  const langTitles: Record<string, string> = {};
  for (const lg of item.languages) {
    if (lg.title) langTitles[lg.lang] = lg.title;
  }
  if (Object.keys(langTitles).length > 0) {
    meta.titles = { ...(meta.titles ?? {}), ...langTitles };
  }

  await saveSongMeta(songId, meta, albumId);

  // Ensure at least one translation exists per language found
  const languages = [...new Set(audioFiles.map((a) => a.lang))];
  for (const lang of languages) {
    try {
      await getSongTranslation(songId, lang);
    } catch {
      let body = `{title: ${item.title}}\n`;
      // Use lyric file if available
      const lg = item.languages.find((l) => l.lang === lang);
      if (lg?.lyricPath) {
        const { readFile } = await import("fs/promises");
        const pathMod = await import("path");
        const { getMusicDir } = await import("@/lib/music-importer");
        const root = getMusicDir();
        const lyricFullPath = pathMod.join(root, lg.lyricPath);
        try {
          const content = await readFile(lyricFullPath, "utf-8");
          if (content.trim()) body = content;
        } catch (e) {
          console.warn(`Failed to read lyric file: ${lyricFullPath}`, e);
        }
      }

      const frontmatter = {
        language: lang,
        translator: null,
        status: "draft" as const,
        published: false,
      };
      await saveSongTranslation(songId, lang, frontmatter, body, albumId);
    }
  }

  // Add song to album's song list
  const { getAlbum, saveAlbum } = await import("@/lib/content");
  try {
    const album = await getAlbum(albumId!);
    if (!album.songs.includes(songId)) {
      album.songs.push(songId);
      await saveAlbum(album);
    }
  } catch {}

  revalidatePath("/songs");
  revalidatePath(`/songs/${songId}`);
  revalidatePath("/import/music");
  return { songId, title: item.title, audioFiles: audioFiles.length };
}

/* ------------------------------------------------------------------ */
/*  Partitions (sheet music)                                          */
/* ------------------------------------------------------------------ */
export type { PartitionMatch, PartitionFile } from "@/lib/partitions";

/**
 * Scan the /app/partitions folder and match PDFs to songs by title
 * (strict substring on the song's name in any language).
 */
export async function scanPartitionsAction() {
  assertWritable();
  try {
    const { listSongs } = await import("@/lib/content");
    const { matchPartitions } = await import("@/lib/partitions");
    const songs = await listSongs();
    const matches = await matchPartitions(songs);
    return { ok: true as const, matches };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "FAILED",
    };
  }
}

/**
 * Persist the matched partitions into a song's `meta.yaml` (`partitions`).
 */
export async function applyPartitionsAction(
  songId: string,
  partitions: Partition[],
) {
  assertWritable();
  try {
    const meta = await getSong(songId);
    meta.partitions = partitions;
    await saveSongMeta(songId, meta);
    revalidatePath(`/songs/${songId}`);
    revalidatePath("/songs");
    revalidatePath("/browse");
    revalidatePath("/admin/partitions");
    return { ok: true as const, songId };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "FAILED",
    };
  }
}

/**
 * Persist partitions for many songs at once.
 */
export async function applyAllPartitionsAction(
  matches: { songId: string; partitions: Partition[] }[],
) {
  assertWritable();
  try {
    for (const { songId, partitions } of matches) {
      const meta = await getSong(songId);
      meta.partitions = partitions;
      await saveSongMeta(songId, meta);
    }
    revalidatePath("/songs");
    revalidatePath("/browse");
    revalidatePath("/admin/partitions");
    return { ok: true as const, applied: matches.length };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "FAILED",
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Setlist voice shares (Navidrome)                                  */
/* ------------------------------------------------------------------ */
export type { VoiceShareWithTracks } from "@/lib/navidrome/setlist-shares";

/**
 * Generate one Navidrome share per voice section (TENOR / BASS / ALTO /
 * SOPRANO) containing that voice's recordings for all songs in the setlist,
 * and persist the share links on the setlist.
 */
export async function generateSetlistVoiceSharesAction(setlistId: string) {
  assertWritable();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  try {
    const { generateSetlistVoiceShares } = await import(
      "@/lib/navidrome/setlist-shares"
    );
    const setlist = await getSetlist(setlistId);
    const { shares, enriched } = await generateSetlistVoiceShares(setlist);
    await saveSetlist({ ...setlist, voiceShares: shares });
    revalidatePath(`/setlists/${setlistId}`);
    revalidatePath("/setlists");
    return {
      ok: true as const,
      shares,
      sections: enriched.map((share) => share.section),
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "FAILED",
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Setlist visibility & sharing                                      */
/* ------------------------------------------------------------------ */

/**
 * Toggle whether a setlist is visible to anyone (public) or only to editors
 * and holders of the share token (private, the default).
 */
export async function setSetlistPublicAction(setlistId: string, isPublic: boolean) {
  assertWritable();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  try {
    const setlist = await getSetlist(setlistId);
    await saveSetlist({ ...setlist, public: isPublic });
    revalidatePath(`/setlists/${setlistId}`);
    revalidatePath("/setlists");
    return { ok: true as const, public: isPublic };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "FAILED",
    };
  }
}

/**
 * Create (or reuse) the share token for a setlist. Returns the token making
 * up the public link that grants view access to the setlist page to anyone
 * holding it.
 */
export async function createSetlistShareAction(setlistId: string) {
  assertWritable();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  try {
    const setlist = await getSetlist(setlistId);
    const token = setlist.shareToken || randomUUID();
    await saveSetlist({ ...setlist, shareToken: token });
    revalidatePath(`/setlists/${setlistId}`);
    revalidatePath("/setlists");
    return { ok: true as const, shareToken: token };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "FAILED",
    };
  }
}

/**
 * Revoke the share token so only editors (or a "public" setlist) grant
 * access.
 */
export async function deleteSetlistShareAction(setlistId: string) {
  assertWritable();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  try {
    const setlist = await getSetlist(setlistId);
    await saveSetlist({ ...setlist, shareToken: undefined });
    revalidatePath(`/setlists/${setlistId}`);
    revalidatePath("/setlists");
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "FAILED",
    };
  }
}

const SHARE_SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,59}$/;

/**
 * Set (or clear) the custom slug used in the setlist share link
 * (`/setlists/share/<slug>`). Must be URL-safe and unique across setlists.
 * An empty value removes the slug so the link falls back to the share token.
 */
export async function setSetlistShareSlugAction(setlistId: string, slug: string) {
  assertWritable();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const value = slug.trim();
  if (value && !SHARE_SLUG_PATTERN.test(value)) {
    return { ok: false as const, error: "INVALID_SLUG" };
  }
  try {
    const { listSetlists } = await import("@/lib/content");
    const setlist = await getSetlist(setlistId);
    if (value) {
      const all = await listSetlists();
      const taken = all.some(
        (other) => other.id !== setlistId && other.shareSlug === value,
      );
      if (taken) {
        return { ok: false as const, error: "SLUG_TAKEN" };
      }
    }
    await saveSetlist({ ...setlist, shareSlug: value || undefined });
    revalidatePath(`/setlists/${setlistId}`);
    revalidatePath("/setlists");
    return { ok: true as const, slug: value };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "FAILED",
    };
  }
}
