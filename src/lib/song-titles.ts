/**
 * Resolve the display title for a song list item in a given language.
 * Order: meta.yaml `titles` → .cho file title → meta.yaml default `title`.
 * Pure module — no server-only imports, safe for client components.
 */
export function resolveSongListTitle(
  song: {
    title: string;
    titles?: Record<string, string>;
    choTitles?: Record<string, string>;
  },
  lang: string
): string {
  return song.titles?.[lang] || song.choTitles?.[lang] || song.title;
}