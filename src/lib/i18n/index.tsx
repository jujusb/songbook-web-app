'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import type { Translations } from './locales/en';

const LOCALE_STORAGE_KEY = 'songbook-ui-locale';

const locales: Record<string, Translations> = { en, es, fr };

interface I18nContextValue {
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: string) => void;
  availableLocales: { code: string; label: string }[];
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  t: (key: string) => key,
  setLocale: () => {},
  availableLocales: [],
});

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

export function I18nProvider({
  children,
  initialLocale = 'en',
}: {
  children: ReactNode;
  initialLocale?: string;
}) {
  const [locale, setLocaleState] = useState(initialLocale);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && locales[stored]) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(stored);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const setLocale = useCallback((code: string) => {
    if (locales[code]) {
      setLocaleState(code);
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, code);
      } catch {
        // localStorage not available
      }
    }
  }, []);

  const translations = locales[locale] || locales['en'];

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value = resolve(translations, key);
      if (value === undefined) {
        const fallback = resolve(locales['en'], key);
        if (fallback === undefined) return key;
        return interpolate(fallback, params);
      }
      return interpolate(value, params);
    },
    [translations],
  );

  const availableLocales = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
  ];

  return (
    <I18nContext.Provider value={{ locale, t, setLocale, availableLocales }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
