'use client';

import { useTranslation } from '@/lib/i18n';

export function T({
  k,
  params,
}: {
  k: string;
  params?: Record<string, string | number>;
}) {
  const { t } = useTranslation();
  return <>{t(k, params)}</>;
}
