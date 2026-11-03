/**
 * App language codes (BCP 47 style) and the file codes used on disk.
 *
 * The app exposes the codes below in config, URLs, titles keys and stored notes.
 * Content files keep their original names, so only filesystem paths translate:
 * `en-US` is stored as `en.cho`, `es-ES` as `es.cho`. Codes that are not listed
 * map to themselves.
 *
 * Aliases for both the app codes and the legacy short codes are accepted by
 * `normalizeLanguageCode`, so an URL or query may use `es`, `es-ES` and so on.
 */
const APP_TO_FILE: Readonly<Record<string, string>> = {
  'en-US': 'en',
  'es-ES': 'es',
  'fr-FR': 'fr',
  'pt-BR': 'pt',
};

const FILE_TO_APP: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(APP_TO_FILE).map(([app, file]) => [file, app]),
);

const ALIASES: Readonly<Record<string, string>> = {
  en: 'en-US',
  'en-us': 'en-US',
  en_us: 'en-US',
  es: 'es-ES',
  'es-es': 'es-ES',
  es_es: 'es-ES',
  fr: 'fr-FR',
  'fr-fr': 'fr-FR',
  fr_fr: 'fr-FR',
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  pt_br: 'pt-BR',
};

/** App code -> file code used in `<lang>.cho` names and revision folders. */
export function toFileCode(code: string): string {
  return APP_TO_FILE[code] ?? ALIASES[code] == null ? code : APP_TO_FILE[ALIASES[code]] ?? code;
}

/** File code found on disk (e.g. `en` from `en.cho`) -> app code. */
export function toAppCode(fileCode: string): string {
  return FILE_TO_APP[fileCode] ?? ALIASES[fileCode] ?? fileCode;
}

/** Accept old/alias forms (`es`) and new forms (`es-ES`), returning the app code. */
export function normalizeLanguageCode(code: string | undefined | null): string {
  if (!code) return code ?? '';
  const key = String(code).trim();
  if (!key) return key;
  const aliased = ALIASES[key.toLowerCase()];
  if (aliased) return aliased;
  return ALIASES[key] ?? key;
}
