/**
 * Song ids are the folder name under `content/library/<album-id>/<song-id>/`
 * and the `id` field of the song's `meta.yaml`. They must stay stable because
 * audio paths, partitions and setlists reference them, so every creation path
 * slugifies titles the same way.
 */
export function slugifySongId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Strip a trailing file extension: `Amazing Grace.docx` -> `Amazing Grace`. */
export function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

/**
 * Derive a song id from a title, falling back to the source file name when the
 * title has no ASCII characters left (e.g. a fully non-Latin script).
 */
export function songIdFromTitle(title: string, fileName: string): string {
  return (
    slugifySongId(title) ||
    slugifySongId(stripFileExtension(fileName)) ||
    "song"
  );
}

/**
 * Append a numeric suffix until the id is not already present in `taken`,
 * and record it so repeated calls in the same batch stay unique.
 */
export function uniqueSongId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}
