import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import type { Translations } from './locales/en';

const locales: Record<string, Translations> = { en, es, fr };
const LOCALE_STORAGE_KEY = 'songbook-ui-locale';

function resolve(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

export function createT(uiLocale: string) {
  const translations = locales[uiLocale] || locales['en'];
  return (key: string, params?: Record<string, string | number>): string => {
    const value = resolve(translations, key);
    if (value === undefined) {
      const fallback = resolve(locales['en'], key);
      if (fallback === undefined) return key;
      return interpolate(fallback, params);
    }
    return interpolate(value, params);
  };
}

export function plural(template: string, n: number): string {
  const parts = template.split('|').map((s) => s.trim());
  if (n === 1) return parts[0] || parts[1] || template;
  return parts[1] || parts[0] || template;
}

export function getLocale(cookieStore?: {
  get: (name: string) => { value: string } | undefined;
}): string {
  if (cookieStore) {
    const cookie = cookieStore.get(LOCALE_STORAGE_KEY);
    if (cookie && locales[cookie.value]) return cookie.value;
  }
  return 'en';
}
