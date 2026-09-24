'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

/**
 * Button on setlist pages (member + read-only/share) that opens the unified
 * "Convert to PDF" page pre-targeted at this setlist's sheet-music export.
 * The scope is locked in `/pdf` to this setlist — the visitor can still pick
 * the export type (chords/instrumental), languages, and instrument/parts.
 */
export function SetlistPdfButton({
  setlistId,
  shareToken,
}: {
  setlistId: string;
  shareToken?: string;
}) {
  const { t } = useTranslation();

  const query = new URLSearchParams({
    type: 'instrumental',
    scope: 'setlist',
    id: setlistId,
  });
  if (shareToken) query.set('share', shareToken);

  return (
    <Link
      href={`/pdf?${query.toString()}`}
      className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center"
    >
      {t('setlist.pdfInstruments')}
    </Link>
  );
}