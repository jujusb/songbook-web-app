"use server";

import { saveSongTranslation, saveSongMeta, createSong, getSong, getSongTranslation } from "@/lib/content";
import { SongTranslationFrontmatterSchema, type Reference } from "@/lib/content/schemas";
import { revalidatePath } from "next/cache";
import matter from "gray-matter";

export async function saveSongAction(songId: string, lang: string, content: string) {
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
  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/edit/${songId}/${lang}`);
}

export async function createSongAction(formData: FormData) {
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
  const meta = await getSong(songId);
  meta.references = references;
  await saveSongMeta(songId, meta);
  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/edit/${songId}/[lang]`);
}
