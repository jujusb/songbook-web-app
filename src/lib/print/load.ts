import {
  getSong,
  getSongTranslations,
  getSongTranslation,
  getSongTitle,
} from '@/lib/content';
import { renderToHtml, renderReferencesHtml } from '@/lib/chordpro';
import type { PrintSong } from '@/lib/print/types';
import type { ResolvedScopeSong } from '@/lib/export/song-scope';

/**
 * Parse-only plan of the chapters a print run would produce for a scope —
 * used by the PDF conversion page's viewer to show exactly what will be
 * downloaded without rendering any HTML.
 */
export interface ChapterPlan {
  songId: string;
  title: string;
  key?: string;
  lang: string;
}

export async function planSongbookChapters(
  songs: ResolvedScopeSong[],
  languages: string[],
): Promise<ChapterPlan[]> {
  const plan: ChapterPlan[] = [];
  for (const resolved of songs) {
    const songId = resolved.songId;
    if (resolved.lang != null) {
      const title = await getSongTitle(songId, resolved.lang).catch(
        () => resolved.meta?.title ?? songId,
      );
      plan.push({
        songId,
        title,
        key: resolved.meta?.key,
        lang: resolved.lang,
      });
      continue;
    }
    const translations = await getSongTranslations(songId).catch(() => [] as string[]);
    for (const lang of languages) {
      if (!translations.includes(lang)) continue;
      const title = await getSongTitle(songId, lang).catch(
        () => resolved.meta?.title ?? songId,
      );
      plan.push({
        songId,
        title,
        key: resolved.meta?.key,
        lang,
      });
    }
  }
  return plan;
}

/**
 * Build the list of printable song chapters from a resolved scope.
 *
 * - Setlist items carry an explicit `lang`: that translation is always used.
 * - Other scopes iterate `languages`: for each song every requested language
 *   with an available translation produces one chapter.
 *
 * `showRefs` embeds song references (when present) under each chapter, in the
 * chapter's language.
 */
export async function loadPrintSongs(
  songs: ResolvedScopeSong[],
  languages: string[],
  showRefs: boolean,
  inlineChords: boolean = false,
): Promise<PrintSong[]> {
  const printSongs: PrintSong[] = [];

  for (const resolved of songs) {
    const songId = resolved.songId;
    const langs =
      resolved.lang != null
        ? [resolved.lang]
        : await getSongTranslations(songId).catch(() => []);
    const requested = resolved.lang != null
      ? [resolved.lang]
      : languages;

    const meta = showRefs ? await getSong(songId).catch(() => null) : null;

    for (const lang of requested) {
      if (!langs.includes(lang)) continue;
      try {
        const { meta: translationMeta } = await getSongTranslation(songId, lang);
        // Skip unpublished translations
        if (!translationMeta.published) continue;
        const { body } = await getSongTranslation(songId, lang);
        const title = resolved.meta?.titles?.[lang]
          ?? (resolved.meta as { choTitles?: Record<string, string> } | null | undefined)?.choTitles?.[lang]
          ?? resolved.meta?.title
          ?? songId;
        printSongs.push({
          id: songId,
          title,
          key: resolved.meta?.key ?? meta?.key,
          lang,
          html: renderToHtml(body, { inlineChords }),
          refsHtml:
            showRefs && meta?.references?.length
              ? renderReferencesHtml(meta.references, lang)
              : '',
        });
      } catch {
        // skip unreadable translation
      }
    }
  }

  return printSongs;
}