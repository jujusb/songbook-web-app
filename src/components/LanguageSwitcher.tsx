"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

export function LanguageSwitcher({
  songId,
  languages,
  currentLang,
  linkFor,
  onRemove,
  onAdd,
  availableToAdd = [],
  busy = null,
}: {
  songId: string;
  languages: string[];
  currentLang: string;
  linkFor?: (lang: string) => string;
  onRemove?: (lang: string) => void;
  onAdd?: (lang: string) => void;
  availableToAdd?: string[];
  busy?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSelection, setAddSelection] = useState("");

  const navigate = (lang: string) => {
    setConfirmingRemove(null);
    setShowAddForm(false);
    router.push(linkFor ? linkFor(lang) : `${pathname}?lang=${lang}`);
  };

  const openAddForm = () => {
    setAddSelection(availableToAdd[0] ?? "");
    setShowAddForm(true);
  };

  return (
    <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800 flex-wrap">
      {languages.map((lang) => (
        <div key={lang} className="flex items-center">
          <button
            data-lang={`tab-${lang}`}
            onClick={() => navigate(lang)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              lang === currentLang
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-neutral-500 hover:text-foreground hover:border-neutral-300"
            }`}
          >
            {lang.toUpperCase()}
          </button>
          {onRemove && (
            confirmingRemove === lang ? (
              <span className="flex items-center gap-1.5 ml-1 mr-1.5 py-1 pr-1.5 pl-2.5 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-md">
                <span className="text-xs font-medium text-red-700 dark:text-red-300 whitespace-nowrap">
                  {t("common.deleteQuestion")}
                </span>
                <button
                  type="button"
                  data-lang={`remove-confirm-${lang}`}
                  title={t("common.delete")}
                  onClick={() => {
                    setConfirmingRemove(null);
                    onRemove(lang);
                  }}
                  disabled={busy !== null}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-[11px] leading-none hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  {"\u2713"}
                </button>
                <button
                  type="button"
                  data-lang={`remove-cancel-${lang}`}
                  title={t("common.cancel")}
                  onClick={() => setConfirmingRemove(null)}
                  disabled={busy !== null}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 text-xs leading-none hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-40 transition-colors"
                >
                  {"\u00d7"}
                </button>
              </span>
            ) : (
              <button
                type="button"
                data-lang={`remove-${lang}`}
                title={t("song.removeTranslation")}
                onClick={() => setConfirmingRemove(lang)}
                disabled={busy !== null}
                className="px-1.5 py-2 text-sm font-semibold text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400 disabled:opacity-40 transition-colors"
              >
                {"\u00d7"}
              </button>
            )
          )}
        </div>
      ))}
      {onAdd && availableToAdd.length > 0 && (
        <div className="flex items-center gap-1">
          {showAddForm ? (
            <>
              <select
                value={addSelection}
                data-lang="add-select"
                onChange={(e) => setAddSelection(e.target.value)}
                className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-950 outline-none"
                aria-label={t("song.selectLanguage")}
              >
                {availableToAdd.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-lang="add-submit"
                title={t("common.save")}
                onClick={() => {
                  if (!addSelection) return;
                  setShowAddForm(false);
                  onAdd(addSelection);
                }}
                disabled={busy !== null || !addSelection}
                className="px-1.5 py-1 text-sm text-neutral-500 hover:text-blue-600 dark:text-neutral-500 dark:hover:text-blue-400 disabled:opacity-40"
              >
                &#43;
              </button>
              <button
                type="button"
                title={t("common.cancel")}
                onClick={() => setShowAddForm(false)}
                disabled={busy !== null}
                className="px-1.5 py-1 text-sm text-neutral-400 hover:text-red-600 disabled:opacity-40"
              >
                &times;
              </button>
            </>
          ) : (
            <button
              type="button"
              data-lang="add-open"
              title={t("song.addTranslation")}
              onClick={openAddForm}
              disabled={busy !== null}
              className="px-3 py-2 text-sm font-medium text-neutral-500 hover:text-blue-600 dark:text-neutral-500 dark:hover:text-blue-400 disabled:opacity-40"
            >
              &#43;
            </button>
          )}
        </div>
      )}
    </div>
  );
}