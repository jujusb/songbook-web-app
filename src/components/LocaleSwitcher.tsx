'use client';

import { useTranslation } from '@/lib/i18n';

export function LocaleSwitcher() {
  const { locale, setLocale, availableLocales } = useTranslation();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
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
