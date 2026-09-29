"use server";

import { saveSongTranslation, saveSongMeta, createSong, getSong, getSongTranslation, getSiteConfig, extractBodyTitle, addSongTranslation, deleteSongTranslation, renameSong, changeSongAlbum, getSetlist, saveSetlist, listSongs, getAlbum, saveAlbum, createAlbum, getLanguagesConfig, NO_ALBUM_ID } from "@/lib/content";
import { SongTranslationFrontmatterSchema, type Reference, type Partition, type Album } from "@/lib/content/schemas";
import { revalidatePath } from "next/cache";
import matter from "gray-matter";
import { isReadOnly } from "@/lib/readonly";
import { getSession, canEdit } from "@/lib/auth";
import { songIdFromTitle, slugifySongId, uniqueSongId } from "@/lib/song-ids";
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
