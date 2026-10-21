"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { updateMyChordNotationAction } from "@/app/actions";

type Notation = "letters" | "solfege" | "roman" | "nashville";

export function ProfileNotationForm({ initialNotation }: { initialNotation?: string }) {
  const { t } = useTranslation();
  const [notation, setNotation] = useState<Notation>(
    initialNotation === "solfege" || initialNotation === "roman" || initialNotation === "nashville"
      ? (initialNotation as Notation)
      : "letters"
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = async () => {
    setStatus("saving");
    const result = await updateMyChordNotationAction(notation);
    if (result.ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
    }
  };

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-1">{t('profile.notation')}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        {t('profile.notationDesc')}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setNotation("letters")}
          className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
            notation === "letters"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          {t('profile.notationLetters')}
        </button>
        <button
          type="button"
          onClick={() => setNotation("solfege")}
          className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
            notation === "solfege"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          {t('profile.notationSolfege')}
        </button>
        <button
          type="button"
          onClick={() => setNotation("roman")}
          className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
            notation === "roman"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          {t('profile.notationRoman')}
        </button>
        <button
          type="button"
          onClick={() => setNotation("nashville")}
          className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
            notation === "nashville"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          {t('profile.notationNashville')}
        </button>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={status === "saving"}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
      >
        {status === "saving" ? t('profile.notationSaving') : t('profile.notationSave')}
      </button>
      {status === "saved" && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          {t('profile.notationSaved')}
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {t('profile.notationFailed')}
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {t('profile.notationNotes')}
      </p>
    </section>
  );
}
