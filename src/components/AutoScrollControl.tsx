"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  AUTO_SCROLL_SPEED_OPTIONS,
  DEFAULT_AUTO_SCROLL_SPEED,
  secondsPerScreenForSpeed,
} from "@/lib/auto-speed";
import { updateMyAutoScrollSpeedAction } from "@/app/actions";

const SPEED_STORAGE_KEY = "songbook-autoscroll-speed";

/**
 * Floating control that scrolls the current page continuously at a chosen
 * speed. Used on the song and setlist pages where the whole document is
 * displayed instead of the section-by-section projection view.
 */
export function AutoScrollControl({
  initialSpeed,
}: {
  initialSpeed?: number;
}) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed ?? DEFAULT_AUTO_SCROLL_SPEED);

  useEffect(() => {
    if (initialSpeed != null) return;
    try {
      const stored = Number(localStorage.getItem(SPEED_STORAGE_KEY));
      if (stored === 1 || stored === 2 || stored === 3) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSpeed(stored);
      }
    } catch {
      // localStorage not available
    }
  }, [initialSpeed]);

  const changeSpeed = useCallback((value: number) => {
    if (value !== 1 && value !== 2 && value !== 3) return;
    setSpeed(value);
    try {
      localStorage.setItem(SPEED_STORAGE_KEY, String(value));
    } catch {
      // localStorage not available
    }
    void updateMyAutoScrollSpeedAction(value).catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    let last = performance.now();

    const step = (now: number) => {
      const elapsed = Math.min(now - last, 100);
      last = now;

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (window.scrollY >= maxScroll - 1) {
        setEnabled(false);
        return;
      }

      const secondsPerScreen = secondsPerScreenForSpeed(speed);
      window.scrollBy(0, (window.innerHeight / secondsPerScreen) * (elapsed / 1000));
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [enabled, speed]);

  return (
    <div className="no-print fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-neutral-300 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900/95">
      <button
        type="button"
        onClick={() => setEnabled((value) => !value)}
        className={`rounded px-2 py-1 transition-colors ${
          enabled
            ? "bg-blue-600 text-white"
            : "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        }`}
        aria-pressed={enabled}
        title={t("autoScroll.hint")}
      >
        {enabled ? t("autoScroll.on") : t("autoScroll.off")}
      </button>
      <select
        value={speed}
        onChange={(e) => changeSpeed(Number(e.target.value))}
        className="rounded bg-neutral-100 px-1 py-1 dark:bg-neutral-800"
        aria-label={t("autoScroll.speed")}
        title={t("autoScroll.speed")}
      >
        {AUTO_SCROLL_SPEED_OPTIONS.map((value) => (
          <option key={value} value={value}>
            x{value}
          </option>
        ))}
      </select>
    </div>
  );
}
