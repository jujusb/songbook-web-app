"use server";

import { saveSongTranslation, saveSongMeta, createSong, getSong, getSongTranslation, getSiteConfig, extractBodyTitle, addSongTranslation, deleteSongTranslation, renameSong, renameAlbum, changeSongAlbum, getSetlist, saveSetlist, listSongs, getAlbum, saveAlbum, createAlbum, getLanguagesConfig, NO_ALBUM_ID, getAlbumsForSong, findSongPath, listRevisions, getRevision, saveRevision as saveRevisionLib } from "@/lib/content";
import { SongTranslationFrontmatterSchema, type Reference, type Partition, type Album } from "@/lib/content/schemas";
import { revalidatePath } from "next/cache";
import matter from "gray-matter";
import { isReadOnly, isReadOnlyFor } from "@/lib/readonly";
import { getSession, canEdit, canAdmin, canCreateSetlist, canManageSetlistShares, getCurrentUser, canEditSong, saveUser } from "@/lib/auth";
import { songIdFromTitle, slugifySongId, uniqueSongId } from "@/lib/song-ids";
import { randomUUID } from "node:crypto";

function assertWritable() {
  if (isReadOnly()) {
    throw new Error("Read-only mode");
  }
}

function assertSetlistWrite() {
  if (isReadOnlyFor('setlist_write')) {
    throw new Error("Read-only mode: setlist writes disabled");
  }
}

function assertSetlistShare() {
  if (isReadOnlyFor('setlist_share')) {
    throw new Error("Read-only mode: setlist sharing disabled");
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

export async function setSongKeyAction(songId: string, key: string) {
  assertWritable();
  const meta = await getSong(songId);
  const nextKey = key.trim() === "" ? undefined : key.trim();
  const merged: typeof meta = { ...meta, key: nextKey };
  await saveSongMeta(songId, merged);
  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/edit/${songId}`);
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

export async function toggleSongPublishedAction(songId: string, lang: string) {
  assertWritable();
  const session = await getSession();
  if (!canAdmin(session?.role ?? null)) {
    return { ok: false as const, error: 'Admin required' };
  }
  try {
    const { meta: frontmatter, body } = await getSongTranslation(songId, lang);
    frontmatter.published = !frontmatter.published;
    await saveSongTranslation(songId, lang, frontmatter, body);
    revalidatePath(`/songs/${songId}`);
    revalidatePath(`/edit/${songId}/${lang}`);
    revalidatePath("/songs");
    revalidatePath("/browse");
    return { ok: true as const, published: frontmatter.published };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'FAILED' };
  }
}

export async function revertSongToRevisionAction(songId: string, lang: string, timestamp: string) {
  assertWritable();
  const session = await getSession();
  const user = await getCurrentUser();
  if (!canEdit(session?.role ?? null) && !canEditSong(user, songId, lang)) {
    return { ok: false as const, error: 'Unauthorized' };
  }
  try {
    const songPath = await findSongPath(songId);
    if (!songPath) {
      return { ok: false as const, error: 'Song not found' };
    }

    // Convert timestamp to filename format
    const file = timestamp.replace(/[-T:]/g, '-').replace(/--/g, '-') + '.cho';
    
    // Get the revision content
    const revisionContent = await getRevision(songPath, lang, file);
    
    // Parse the revision content
    const { meta: currentMeta } = await getSongTranslation(songId, lang);
    const matter = await import("gray-matter");
    const parsed = matter.default(revisionContent);
    const parsedData = parsed.data as { language?: string; status?: 'draft' | 'review' | 'final'; published?: boolean; title?: string; translator?: string | null; lastModified?: string; modifiedBy?: string };
    const frontmatter = parsedData.language 
      ? { language: parsedData.language, status: parsedData.status || 'draft', published: parsedData.published || false, title: parsedData.title, translator: parsedData.translator, lastModified: parsedData.lastModified, modifiedBy: parsedData.modifiedBy }
      : currentMeta;
    const body = parsed.content.trim();

    // Save current version as revision first
    await saveRevisionLib(songPath, lang);
    
    // Apply the revision as current
    await saveSongTranslation(songId, lang, frontmatter, body);

    revalidatePath(`/songs/${songId}`);
    revalidatePath(`/edit/${songId}/${lang}`);
    revalidatePath("/songs");
    revalidatePath("/browse");
    
    return { ok: true as const, message: "Reverted to revision" };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'FAILED' };
  }
}

export async function publishRevisionAction(songId: string, lang: string, timestamp: string) {
  assertWritable();
  const session = await getSession();
  const user = await getCurrentUser();
  if (!canEdit(session?.role ?? null) && !canEditSong(user, songId, lang)) {
    return { ok: false as const, error: 'Unauthorized' };
  }
  try {
    const songPath = await findSongPath(songId);
    if (!songPath) {
      return { ok: false as const, error: 'Song not found' };
    }

    // Convert timestamp to filename format
    const file = timestamp.replace(/[-T:]/g, '-').replace(/--/g, '-') + '.cho';
    
    // Get the revision content
    const revisionContent = await getRevision(songPath, lang, file);
    
    // Parse the revision content
    const { meta: currentMeta } = await getSongTranslation(songId, lang);
    const matter = await import("gray-matter");
    const parsed = matter.default(revisionContent);
    const parsedData = parsed.data as { language?: string; status?: 'draft' | 'review' | 'final'; published?: boolean; title?: string; translator?: string | null; lastModified?: string; modifiedBy?: string };
    const frontmatter = parsedData.language 
      ? { language: parsedData.language, status: parsedData.status || 'draft', published: parsedData.published || false, title: parsedData.title, translator: parsedData.translator, lastModified: parsedData.lastModified, modifiedBy: parsedData.modifiedBy }
      : currentMeta;
    const body = parsed.content.trim();

    // Apply the revision as current WITHOUT creating a revision of current
    await saveSongTranslation(songId, lang, frontmatter, body);

    revalidatePath(`/songs/${songId}`);
    revalidatePath(`/edit/${songId}/${lang}`);
    revalidatePath("/songs");
    revalidatePath("/browse");
    
    return { ok: true as const, message: "Published revision" };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : 'FAILED' };
  }
}

export async function createSongAction(formData: FormData) {
  assertWritable();
  const title = formData.get("title") as string;
  const lang = (formData.get("lang") as string) || "en";

  if (!title) {
    throw new Error("Title is required");
  }

  // Generate slug from title (never empty: a non-Latin title would otherwise
  // resolve to the album folder itself)
  const id = songIdFromTitle(title, "");

  await createSong(id, title, lang);
  revalidatePath("/songs");
  return { id, lang };
}

/** One document queued for a bulk import. ChordPro is converted in the browser. */
export type BulkImportItem = {
  fileName: string;
  /** Source format the file was converted from: `docx`, `pdf` or `txt`. */
  format: string;
  title: string;
  /** Explicit song id; slugified on the server. Derived from the title if empty. */
  id?: string;
  lang: string;
  /** Overrides the batch album when set. */
  albumId: string;
  chordpro: string;
  key?: string;
};

/**
 * Where the whole batch lands. A song's artist is derived from its album, so the
 * two are always chosen together: pick one of the artist's albums, or name a new
 * album to create under that artist.
 */
export type BulkImportAlbum = {
  artistId: string;
  /** Existing album id. Empty means "use `newAlbumTitle`". */
  albumId: string;
  newAlbumTitle: string;
  newAlbumYear?: number;
};

export type BulkImportOutcome = {
  fileName: string;
  title: string;
  ok: boolean;
  songId?: string;
  albumId?: string;
  /** i18n key suffix under `bulkImport.error.`, e.g. `NO_TITLE`. */
  error?: string;
  detail?: string;
};

export type BulkImportResult = {
  outcomes: BulkImportOutcome[];
  /** Album created for this batch, if any. */
  createdAlbum?: { id: string; title: string };
};

const MAX_BULK_IMPORT_FILES = 200;

/** Prepend `{key: ...}` when the converted source has no key directive yet. */
function buildImportedBody(body: string, title: string, key: string): string {
  const withKey =
    key && !/\{key:\s*[^}]*\}/i.test(body)
      ? `{key: ${key}}\n\n${body}`
      : body;
  return setBodyTitle(withKey, title);
}

/**
 * Find or create the album a batch imports into. `createAlbum` overwrites
 * album.yaml wholesale, so an existing album with the same slug is reused
 * rather than recreated (which would drop its song list).
 */
async function resolveBatchAlbum(
  target: BulkImportAlbum,
  loadAlbum: (id: string) => Promise<Album | null>,
): Promise<{ album: Album | null; created?: { id: string; title: string } }> {
  if (target.albumId) {
    return { album: await loadAlbum(target.albumId) };
  }

  const title = target.newAlbumTitle.trim();
  if (!title) return { album: null };

  const id = slugifySongId(title) || "imported-album";
  const existing = await loadAlbum(id);
  if (existing) return { album: existing };

  await createAlbum(id, title, target.artistId || "various-artists", target.newAlbumYear);
  return {
    album: await loadAlbum(id),
    created: { id, title },
  };
}

/**
 * Pick the song id for an imported file. A hand-entered id wins, but it is run
 * through the slugifier first: ids become directory names, so anything that is
 * not `[a-z0-9-]` (including traversal sequences) is stripped here.
 */
function resolveSongId(item: BulkImportItem, title: string, fileName: string): string {
  const requested = (item.id ?? "").trim();
  return slugifySongId(requested) || songIdFromTitle(title, fileName);
}

/**
 * Create one song per item, in order, reporting success or failure per file so a
 * single bad document never aborts the batch. Songs land in the chosen album (or
 * the "no album" bucket) and the album song lists are rewritten once at the end.
 */
export async function bulkImportSongsAction(
  items: BulkImportItem[],
  target?: BulkImportAlbum
): Promise<BulkImportResult> {
  assertWritable();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) throw new Error("Unauthorized");
  if (!Array.isArray(items) || items.length === 0) return { outcomes: [] };
  if (items.length > MAX_BULK_IMPORT_FILES) throw new Error("TOO_MANY_FILES");

  const langConfig = await getLanguagesConfig().catch(() => null);
  const languages = new Set(langConfig?.languages ?? []);
  const defaultLang = langConfig?.default ?? "en";

  const takenIds = new Set((await listSongs()).map((s) => s.id));
  const albumCache = new Map<string, Album | null>();
  const albumEdits = new Map<string, Album>();
  const outcomes: BulkImportOutcome[] = [];

  const loadAlbum = async (id: string): Promise<Album | null> => {
    if (!albumCache.has(id)) {
      albumCache.set(id, await getAlbum(id).catch(() => null));
    }
    return albumCache.get(id) ?? null;
  };

  const batch = target ? await resolveBatchAlbum(target, loadAlbum) : { album: null };

  for (const item of items) {
    const fileName = typeof item?.fileName === "string" ? item.fileName : "";
    const title = (item?.title ?? "").trim();
    const chordpro = (item?.chordpro ?? "").trim();
    const key = (item?.key ?? "").trim();
    const fail = (error: string, detail?: string) =>
      outcomes.push({ fileName, title, ok: false, error, detail });

    if (!title) {
      fail("NO_TITLE");
      continue;
    }
    if (!chordpro) {
      fail("EMPTY_CONTENT");
      continue;
    }

    const lang = languages.has(item.lang) ? item.lang : defaultLang;

    // Unknown album ids (or none chosen) fall back to the "no album" bucket so
    // a song can never be orphaned in a folder no album.yaml points at.
    const album = item.albumId ? await loadAlbum(item.albumId) : batch.album;
    const albumId = album ? album.id : NO_ALBUM_ID;

    const songId = uniqueSongId(resolveSongId(item, title, fileName), takenIds);

    try {
      await createSong(
        songId,
        title,
        lang,
        albumId,
        buildImportedBody(chordpro, title, key)
      );

      if (key) {
        const meta = await getSong(songId);
        await saveSongMeta(songId, { ...meta, key }, albumId);
      }

      if (album) {
        const edited = albumEdits.get(albumId) ?? album;
        if (!edited.songs.includes(songId)) edited.songs.push(songId);
        albumEdits.set(albumId, edited);
      }

      outcomes.push({ fileName, title, ok: true, songId, albumId });
    } catch (err) {
      fail("FAILED", err instanceof Error ? err.message : undefined);
    }
  }

  for (const [albumId, album] of albumEdits) {
    await saveAlbum(album).catch((err) => {
      console.warn(`bulk import: could not update album ${albumId}`, err);
    });
  }

  revalidatePath("/songs");
  revalidatePath("/browse");
  revalidatePath("/albums");

  return { outcomes, createdAlbum: batch.created };
}

export async function saveSongReferencesAction(songId: string, references: Reference[]) {
  assertWritable();
  const meta = await getSong(songId);
  meta.references = references;
  await saveSongMeta(songId, meta);
  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/edit/${songId}/[lang]`, "page");
}

export async function saveSongLinksAction(
  songId: string,
  links: {
    spotifySong?: string;
    youtube?: string;
  },
) {
  assertWritable();
  const meta = await getSong(songId);
  const spotifySong = links.spotifySong?.trim() || undefined;
  const youtube = links.youtube?.trim() || undefined;
  meta.spotify = spotifySong ? { ...(meta.spotify ?? {}), song: spotifySong } : undefined;
  meta.youtube = youtube;
  await saveSongMeta(songId, meta);
  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/edit/${songId}/[lang]`, "page");
  const albumIds = await getAlbumsForSong(songId);
  for (const albumId of albumIds) revalidatePath(`/albums/${albumId}`);
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

export async function changeAlbumIdAction(oldId: string, newId: string) {
  if (isReadOnly()) {
    return {
      ok: false as const,
      error: 'READ_ONLY',
    };
  }
  try {
    await renameAlbum(oldId, newId);
    revalidatePath(`/albums/${oldId}`);
    revalidatePath(`/albums/${newId}`);
    revalidatePath(`/albums/${newId}/edit`, "page");
    revalidatePath("/albums");
    revalidatePath("/songs");
    revalidatePath("/browse");
    return { ok: true as const, albumId: newId };
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
  assertSetlistWrite();
  const session = await getSession();
  if (!canCreateSetlist(session?.role ?? null)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  try {
    const setlist = await getSetlist(setlistId);
    // Check ownership for setlist_creator
    const isOwner = setlist.ownerId === session?.userId;
    const canEditAll = canEdit(session?.role ?? null);
    if (!isOwner && !canEditAll) {
      return { ok: false as const, error: "Forbidden: not the owner" };
    }
    const { generateSetlistVoiceShares } = await import(
      "@/lib/navidrome/setlist-shares"
    );
    const { shares, enriched } = await generateSetlistVoiceShares(setlist, { role: session?.role ?? 'public' });
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
  assertSetlistShare();
  const session = await getSession();
  if (!canManageSetlistShares(session?.role ?? null)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  try {
    const setlist = await getSetlist(setlistId);
    // Check ownership for setlist_creator
    const isOwner = setlist.ownerId === session?.userId;
    const canEditAll = canEdit(session?.role ?? null);
    if (!isOwner && !canEditAll) {
      return { ok: false as const, error: "Forbidden: not the owner" };
    }
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
  assertSetlistShare();
  const session = await getSession();
  if (!canManageSetlistShares(session?.role ?? null)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  try {
    const setlist = await getSetlist(setlistId);
    // Check ownership for setlist_creator
    const isOwner = setlist.ownerId === session?.userId;
    const canEditAll = canEdit(session?.role ?? null);
    if (!isOwner && !canEditAll) {
      return { ok: false as const, error: "Forbidden: not the owner" };
    }
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
  assertSetlistShare();
  const session = await getSession();
  if (!canManageSetlistShares(session?.role ?? null)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  try {
    const setlist = await getSetlist(setlistId);
    // Check ownership for setlist_creator
    const isOwner = setlist.ownerId === session?.userId;
    const canEditAll = canEdit(session?.role ?? null);
    if (!isOwner && !canEditAll) {
      return { ok: false as const, error: "Forbidden: not the owner" };
    }
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
  assertSetlistShare();
  const session = await getSession();
  if (!canManageSetlistShares(session?.role ?? null)) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const value = slug.trim();
  if (value && !SHARE_SLUG_PATTERN.test(value)) {
    return { ok: false as const, error: "INVALID_SLUG" };
  }
  try {
    const { listSetlists } = await import("@/lib/content");
    const setlist = await getSetlist(setlistId);
    // Check ownership for setlist_creator
    const isOwner = setlist.ownerId === session?.userId;
    const canEditAll = canEdit(session?.role ?? null);
    if (!isOwner && !canEditAll) {
      return { ok: false as const, error: "Forbidden: not the owner" };
    }
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

/* ------------------------------------------------------------------ */
/*  Profile (the logged-in user's own preferences)                    */
/* ------------------------------------------------------------------ */

const VOICE_SECTIONS = ['tenor', 'bass', 'alto', 'soprano'] as const;
type VoiceSectionValue = (typeof VOICE_SECTIONS)[number];

/**
 * Save the logged-in user's preferred voice section. The user's voice is
 * selected by default on song pages (players) and setlist voice playlists.
 * Allowed in read-only mode (a self-service account preference, like
 * registration), and works for every role with an account.
 */
export async function updateMyVoicePreferenceAction(voice: string | null) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const value =
    voice === null
      ? undefined
      : (VOICE_SECTIONS as readonly string[]).includes(voice)
        ? (voice as VoiceSectionValue)
        : undefined;
  if (voice !== null && value === undefined) {
    return { ok: false as const, error: "INVALID_VOICE" };
  }
  try {
    await saveUser({ ...user, voice: value }, { allowReadOnly: true });
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "FAILED",
    };
  }
}
