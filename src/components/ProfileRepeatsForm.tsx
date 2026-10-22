"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { updateMyRepeatsPreferenceAction } from "@/app/actions";

export function ProfileRepeatsForm({ initialShowRepeats }: { initialShowRepeats?: boolean }) {
  const { t } = useTranslation();
  const [showRepeats, setShowRepeats] = useState<boolean>(initialShowRepeats ?? true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = async () => {
    setStatus("saving");
    const result = await updateMyRepeatsPreferenceAction(showRepeats);
    if (result.ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
    }
  };

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-1">{t('profile.repeats')}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        {t('profile.repeatsDesc')}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setShowRepeats(true)}
          className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
            showRepeats
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          {t('profile.repeatsOn')}
        </button>
        <button
          type="button"
          onClick={() => setShowRepeats(false)}
          className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
            !showRepeats
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          {t('profile.repeatsOff')}
        </button>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={status === "saving"}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
      >
        {status === "saving" ? t('profile.repeatsSaving') : t('profile.repeatsSave')}
      </button>
      {status === "saved" && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          {t('profile.repeatsSaved')}
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {t('profile.repeatsFailed')}
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {t('profile.repeatsNotes')}
      </p>
    </section>
  );
}
