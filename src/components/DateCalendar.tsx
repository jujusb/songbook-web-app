"use client";

import { useMemo, useState, type ReactNode } from "react";
import { parseIsoDate } from "@/lib/note-schedule";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DateCalendarProps {
  /** Selected date (YYYY-MM-DD). Empty shows the current month. */
  value: string;
  onChange: (date: string) => void;
  /** Whether a day can be clicked. Other days are shown greyed out. */
  isSelectable: (date: string) => boolean;
  /** Days that have saved data; shown with a dot. */
  marked?: ReadonlySet<string>;
  /** Text under the grid, e.g. the rule or a warning. */
  footer?: ReactNode;
  label?: string;
}

/** Month grid where only the days `isSelectable` accepts can be clicked. */
export function DateCalendar({ value, onChange, isSelectable, marked, footer, label }: DateCalendarProps) {
  const parts = parseIsoDate(value);
  const anchorYear = parts?.year ?? new Date().getUTCFullYear();
  const anchorMonth = parts?.month ?? new Date().getUTCMonth() + 1;
  const anchorKey = `${anchorYear}-${anchorMonth}`;

  // Navigation is remembered against the value's month; when the value moves
  // to another month (selection or correction) the view follows it.
  const [nav, setNav] = useState<{ anchor: string; year: number; month: number } | null>(null);
  const view = useMemo(
    () => (nav && nav.anchor === anchorKey ? nav : { anchor: anchorKey, year: anchorYear, month: anchorMonth }),
    [nav, anchorKey, anchorYear, anchorMonth],
  );

  const shift = (delta: number) => {
    const index = view.year * 12 + (view.month - 1) + delta;
    setNav({ anchor: anchorKey, year: Math.floor(index / 12), month: (index % 12) + 1 });
  };

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
    const list: Array<string | null> = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) {
      list.push(`${view.year}-${String(view.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    return list;
  }, [view]);

  return (
    <div className="inline-block rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-sm">
      {label && <div className="mb-1 text-xs text-neutral-500">{label}</div>}
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">&larr;</button>
        <span className="font-medium" data-testid="calendar-month">{MONTHS[view.month - 1]} {view.year}</span>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">&rarr;</button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-neutral-500">
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((iso, index) => {
          if (!iso) return <span key={`blank-${index}`} />;
          const day = Number(iso.slice(8));
          if (!isSelectable(iso)) {
            return (
              <span key={iso} className="py-1 text-neutral-300 dark:text-neutral-700" data-date={iso}>{day}</span>
            );
          }
          const selected = iso === value;
          const hasData = marked?.has(iso) ?? false;
          return (
            <button
              key={iso}
              type="button"
              data-date={iso}
              aria-label={iso}
              aria-pressed={selected}
              onClick={() => onChange(iso)}
              className={`relative rounded py-1 font-medium ${
                selected
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
              }`}
            >
              {day}
              {hasData && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${selected ? "bg-white" : "bg-blue-600 dark:bg-blue-300"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {footer && <div className="mt-2 text-xs text-neutral-500">{footer}</div>}
    </div>
  );
}
