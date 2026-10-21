"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { updateMyChordsPreferenceAction } from "@/app/actions";

export function ProfileChordsForm({ initialShowChords }: { initialShowChords?: boolean }) {
  const { t } = useTranslation();
  const [showChords, setShowChords] = useState<boolean>(initialShowChords ?? true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = async () => {
    setStatus("saving");
    const result = await updateMyChordsPreferenceAction(showChords);
    if (result.ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
    }
  };

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-1">{t('profile.chords')}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        {t('profile.chordsDesc')}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setShowChords(true)}
          className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
            showChords
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          {t('profile.chordsOn')}
        </button>
        <button
          type="button"
          onClick={() => setShowChords(false)}
          className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
            !showChords
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          {t('profile.chordsOff')}
        </button>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={status === "saving"}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
      >
        {status === "saving" ? t('profile.chordsSaving') : t('profile.chordsSave')}
      </button>
      {status === "saved" && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          {t('profile.chordsSaved')}
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {t('profile.chordsFailed')}
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {t('profile.chordsNotes')}
      </p>
    </section>
  );
}
