'use client';

import { useTranslation } from '@/lib/i18n';

const LOCALE_STORAGE_KEY = 'songbook-ui-locale';

export function LocaleSwitcher() {
  const { locale, setLocale, availableLocales } = useTranslation();

  const handleChange = (value: string) => {
    setLocale(value);
    // Mirror the locale in a cookie so server-rendered pages (e.g. album
    // and print lists) can resolve localized titles for the active UI language.
    try {
      document.cookie = `${LOCALE_STORAGE_KEY}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // cookies unavailable
    }
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs bg-transparent border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5 text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors cursor-pointer outline-none"
      aria-label="UI Language"
    >
      {availableLocales.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
