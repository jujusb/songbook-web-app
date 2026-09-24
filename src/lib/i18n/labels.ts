const displayNamesCache = new Map<string, Intl.DisplayNames>();

export const FALLBACK_LANGUAGES = [
  'en',
] as const;

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s;
}

/**
 * Resolve a language's native label via Intl.DisplayNames
 * (e.g. `en` → "English", `es` → "Español", `ja` → "日本語").
 * Unknown codes fall back to the uppercased code (previous behavior).
 */
export function languageLabelFor(code: string): string {
  try {
    let displayNames = displayNamesCache.get(code);
    if (!displayNames) {
      displayNames = new Intl.DisplayNames([code], { type: 'language' });
      displayNamesCache.set(code, displayNames);
    }
    const label = displayNames.of(code);
    if (label) return capitalizeFirst(label);
  } catch {
    // invalid code — fall through to uppercase fallback
  }
  return code.toUpperCase();
}