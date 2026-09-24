'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';

export function SetlistPdfButton({
  setlistId,
  shareToken,
}: {
  setlistId: string;
  shareToken?: string;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleDownload = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({ setlist: setlistId });
      if (shareToken) params.set('share', shareToken);
      const res = await fetch(`/api/pdf?${params.toString()}`);
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? `${setlistId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [setlistId, shareToken]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {busy ? t('setlist.preparingPdf') : t('setlist.downloadPdf')}
      </button>
      {failed && (
        <span className="text-sm text-red-600 dark:text-red-400">
          {t('setlist.pdfFailed')}
        </span>
      )}
    </div>
  );
}