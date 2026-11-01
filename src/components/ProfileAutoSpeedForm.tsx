"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  AUTO_ADVANCE_SPEED_OPTIONS,
  AUTO_SCROLL_SPEED_OPTIONS,
  DEFAULT_AUTO_ADVANCE_SECONDS,
  DEFAULT_AUTO_SCROLL_SECONDS,
  speedOptionsWith,
} from "@/lib/auto-speed";
import {
  updateMyAutoAdvanceSpeedAction,
  updateMyAutoScrollSpeedAction,
} from "@/app/actions";

export function ProfileAutoSpeedForm({
  initialAutoAdvanceSeconds,
  initialAutoScrollSeconds,
}: {
  initialAutoAdvanceSeconds?: number;
  initialAutoScrollSeconds?: number;
}) {
  const { t } = useTranslation();
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState(
    initialAutoAdvanceSeconds ?? DEFAULT_AUTO_ADVANCE_SECONDS
  );
  const [autoScrollSeconds, setAutoScrollSeconds] = useState(
    initialAutoScrollSeconds ?? DEFAULT_AUTO_SCROLL_SECONDS
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = async () => {
    setStatus("saving");
    try {
      // Sequential writes: each action reads the user file before saving, so
      // running them in parallel could drop one of the two preferences.
      const advanceResult = await updateMyAutoAdvanceSpeedAction(autoAdvanceSeconds);
      const scrollResult = await updateMyAutoScrollSpeedAction(autoScrollSeconds);
      if (advanceResult.ok && scrollResult.ok) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const advanceOptions = speedOptionsWith(
    AUTO_ADVANCE_SPEED_OPTIONS,
    autoAdvanceSeconds
  );
  const scrollOptions = speedOptionsWith(
    AUTO_SCROLL_SPEED_OPTIONS,
    autoScrollSeconds
  );

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-1">{t("profile.autoSpeed")}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        {t("profile.autoSpeedDesc")}
      </p>
      <div className="flex flex-col gap-4 mb-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span>{t("profile.autoAdvanceSpeed")}</span>
          <select
            value={autoAdvanceSeconds}
            onChange={(e) => setAutoAdvanceSeconds(Number(e.target.value))}
            className="px-2 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm bg-transparent"
          >
            {advanceOptions.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds}s
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span>{t("profile.autoScrollSpeed")}</span>
          <select
            value={autoScrollSeconds}
            onChange={(e) => setAutoScrollSeconds(Number(e.target.value))}
            className="px-2 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm bg-transparent"
          >
            {scrollOptions.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds}s
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={status === "saving"}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
      >
        {status === "saving" ? t("profile.autoSpeedSaving") : t("profile.autoSpeedSave")}
      </button>
      {status === "saved" && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          {t("profile.autoSpeedSaved")}
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {t("profile.autoSpeedFailed")}
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {t("profile.autoSpeedNotes")}
      </p>
    </section>
  );
}
