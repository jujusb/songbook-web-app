'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import { languageLabelFor } from './labels';
import type { Translations } from './locales/en';

const LOCALE_STORAGE_KEY = 'songbook-ui-locale';

const locales: Record<string, Translations> = { en, es, fr };

interface I18nContextValue {
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  languageLabel: (code: string) => string;
  setLocale: (locale: string) => void;
  availableLocales: { code: string; label: string }[];
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  t: (key: string) => key,
  languageLabel: (code: string) => code.toUpperCase(),
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
  songLanguages,
}: {
  children: ReactNode;
  initialLocale?: string;
  songLanguages?: string[];
}) {
  const [locale, setLocaleState] = useState(initialLocale);

  const songbookCodes = useMemo(
    () => (songLanguages && songLanguages.length > 0 ? songLanguages : Object.keys(locales)),
    [songLanguages],
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && songbookCodes.includes(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(stored);
      }
    } catch {
      // localStorage not available
    }
  }, [songbookCodes]);

  const setLocale = useCallback((code: string) => {
    if (songbookCodes.includes(code)) {
      setLocaleState(code);
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, code);
      } catch {
        // localStorage not available
      }
    }
  }, [songbookCodes]);

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

  const availableLocales = songbookCodes.map((code) => ({
    code,
    label: languageLabelFor(code),
  }));

  const languageLabel = languageLabelFor;

  return (
    <I18nContext.Provider
      value={{ locale, t, languageLabel, setLocale, availableLocales }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
