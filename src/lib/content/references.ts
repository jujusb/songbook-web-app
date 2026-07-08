/**
 * Resolve the reference text for a given language.
 *
 * Priority:
 *   1. `ref.texts[lang]` — language-specific text
 *   2. `ref.text` — fallback default
 *   3. `undefined` — no text available
 */
export function getReferenceText(
  ref: { text?: string; texts?: Record<string, string> },
  lang: string
): string | undefined {
  if (ref.texts && ref.texts[lang]) return ref.texts[lang];
  return ref.text;
}

/**
 * Resolve the highlight text for a given language.
 *
 * Checks for a language-keyed highlight first, then falls back
 * to the flat `highlight` string for backward compatibility.
 */
export function getHighlight(
  source: { highlight?: string; highlights?: Record<string, string> },
  lang: string
): string | undefined {
  if (source.highlights && source.highlights[lang]) return source.highlights[lang];
  return source.highlight;
}
