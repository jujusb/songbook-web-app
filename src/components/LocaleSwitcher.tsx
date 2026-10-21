'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

export function LocaleSwitcher({
  id,
  className = '',
}: {
  id?: string;
  className?: string;
}) {
  const { locale, setLocale, availableLocales } = useTranslation();
  const router = useRouter();

  const handleChange = (value: string) => {
    // The cookie is written by the i18n provider so that every switcher
    // (header, footer, song language tabs) shares the same state.
    setLocale(value);
    // Update URL to include lang param and re-render server components
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', value);
      router.push(url.pathname + url.search);
    } catch {
      router.refresh();
    }
  };

  return (
    <select
      id={id}
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className={`text-xs bg-transparent border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5 text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors cursor-pointer outline-none ${className}`}
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
