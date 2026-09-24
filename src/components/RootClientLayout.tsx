'use client';

import { type ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n';

export function RootClientLayout({
  children,
  initialLocale = 'en',
  songLanguages,
}: {
  children: ReactNode;
  initialLocale?: string;
  songLanguages?: string[];
}) {
  return (
    <I18nProvider initialLocale={initialLocale} songLanguages={songLanguages}>
      {children}
    </I18nProvider>
  );
}
