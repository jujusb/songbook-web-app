"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDaysIso,
  describeNoteRecurrence,
  isSelectableNoteDate,
  parseIsoDate,
  selectableNoteDates,
} from "@/lib/note-schedule";
import type { NoteMetadata } from "@/lib/notes";

const WINDOW_DAYS = 365;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Allowed dates around the value and today, ascending. */
export function allowedNoteDates(note: NoteMetadata, value: string, today: string): string[] {
  const from = addDaysIso(value < today ? value : today, -WINDOW_DAYS);
  const to = addDaysIso(value > today ? value : today, WINDOW_DAYS);
  return selectableNoteDates(note, from, to);
}

/** Closest allowed date to `preferred`, preferring the next one on or after it. */
export function nearestAllowedNoteDate(note: NoteMetadata, preferred: string): string | null {
  const options = allowedNoteDates(note, preferred, preferred);
  if (options.length === 0) return null;
  return options.find((d) => d >= preferred) ?? options[options.length - 1];
}

interface RecurrentDateSelectProps {
  note: NoteMetadata;
  value: string;
  onChange: (date: string) => void;
  /** Replace a disallowed value with the nearest allowed date (default true). */
  autoCorrect?: boolean;
}

/** Month grid for a recurrent note: only dates its recurrence allows are selectable. */
export function RecurrentDateSelect({ note, value, onChange, autoCorrect = true }: RecurrentDateSelectProps) {
  const today = new Date().toISOString().slice(0, 10);
  const valid = isSelectableNoteDate(note, value);
  const parts = parseIsoDate(value) ?? parseIsoDate(today)!;

  // Navigation is stored against the value's month; when the value moves to
  // another month (selection or automatic correction) the view follows it.
  const anchor = value.slice(0, 7);
  const [nav, setNav] = useState<{ anchor: string; year: number; month: number } | null>(null);
  const parsedYear = parts.year;
  const parsedMonth = parts.month;
  const view = useMemo(
    () => (nav && nav.anchor === anchor ? nav : { anchor, year: parsedYear, month: parsedMonth }),
    [nav, anchor, parsedYear, parsedMonth],
  );

  // Replace a disallowed value with the nearest allowed date.
  useEffect(() => {
    if (!autoCorrect || valid || !parseIsoDate(value)) return;
    const next = nearestAllowedNoteDate(note, value);
    if (next && next !== value) onChange(next);
  }, [autoCorrect, valid, note, value, onChange]);

  const hasAnyDate = useMemo(
    () => allowedNoteDates(note, value, today).length > 0,
    [note, value, today],
  );

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
    const list: Array<string | null> = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) {
      const iso = `${view.year}-${String(view.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      list.push(iso);
    }
    return list;
  }, [view]);

  const shift = (delta: number) => {
    const index = view.year * 12 + (view.month - 1) + delta;
    setNav({ anchor, year: Math.floor(index / 12), month: (index % 12) + 1 });
  };

  return (
    <div className="inline-block rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          &larr;
        </button>
        <span className="font-medium" data-testid="note-calendar-month">
          {MONTHS[view.month - 1]} {view.year}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          &rarr;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500 mb-1">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((iso, index) => {
          if (!iso) return <span key={`blank-${index}`} />;
          const allowed = isSelectableNoteDate(note, iso);
          const selected = iso === value;
          if (!allowed) {
            return (
              <span key={iso} className="py-1 text-neutral-300 dark:text-neutral-700" data-date={iso}>
                {Number(iso.slice(8))}
              </span>
            );
          }
          return (
            <button
              key={iso}
              type="button"
              data-date={iso}
              aria-label={iso}
              aria-pressed={selected}
              onClick={() => onChange(iso)}
              className={`rounded py-1 font-medium ${
                selected
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
              }`}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        {describeNoteRecurrence(note)}
        {!hasAnyDate && <span className="block text-red-600">No dates available for this schedule.</span>}
      </p>
    </div>
  );
}
