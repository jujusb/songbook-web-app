"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

export function DeleteButton({
  apiEndpoint,
  id,
  label,
  redirectTo,
}: {
  apiEndpoint: string;
  id: string;
  label: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${apiEndpoint}?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }, [apiEndpoint, id, redirectTo, router]);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600 dark:text-red-400">
          {t('common.confirmDelete', { label })}
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? t('common.deleting') : t('common.delete')}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-sm px-3 py-1 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          {t('common.cancel')}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="px-3 py-1.5 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-md text-sm hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
    >
      {t('common.delete')}
    </button>
  );
}
