"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { updateMyPartitionInstrumentAction } from "@/app/actions";

export function ProfilePartitionsForm({ initialInstrument }: { initialInstrument?: string }) {
  const { t } = useTranslation();
  const [instrument, setInstrument] = useState<string>(initialInstrument ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = async () => {
    setStatus("saving");
    const result = await updateMyPartitionInstrumentAction(instrument || null);
    if (result.ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
    }
  };

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-1">{t('profile.partitions')}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        {t('profile.partitionsDesc')}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          placeholder="e.g. guitar"
          title={t('profile.partitionsNotes')}
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={status === "saving"}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
      >
        {status === "saving" ? t('profile.partitionsSaving') : t('profile.partitionsSave')}
      </button>
      {status === "saved" && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          {t('profile.partitionsSaved')}
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {t('profile.partitionsFailed')}
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {t('profile.partitionsNotes')}
      </p>
    </section>
  );
}
