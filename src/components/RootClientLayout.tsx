'use client';

import { type ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n';

export function RootClientLayout({
  children,
  initialLocale = 'en',
}: {
  children: ReactNode;
  initialLocale?: string;
}) {
  return <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>;
}
