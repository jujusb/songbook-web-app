"use client";

import { useEffect } from "react";
import { DateCalendar } from "@/components/DateCalendar";
import {
  addDaysIso,
  describeNoteRecurrence,
  isSelectableNoteDate,
  parseIsoDate,
  selectableNoteDates,
} from "@/lib/note-schedule";
import type { NoteMetadata } from "@/lib/notes";

const WINDOW_DAYS = 365;

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

/** Month calendar for a recurrent note: only dates its recurrence allows are clickable. */
export function RecurrentDateSelect({ note, value, onChange, autoCorrect = true }: RecurrentDateSelectProps) {
  const today = new Date().toISOString().slice(0, 10);
  const valid = isSelectableNoteDate(note, value);
  const hasAnyDate = allowedNoteDates(note, value, today).length > 0;

  // Replace a disallowed value with the nearest allowed date.
  useEffect(() => {
    if (!autoCorrect || valid || !parseIsoDate(value)) return;
    const next = nearestAllowedNoteDate(note, value);
    if (next && next !== value) onChange(next);
  }, [autoCorrect, valid, note, value, onChange]);

  return (
    <DateCalendar
      value={valid ? value : ""}
      onChange={onChange}
      isSelectable={(date) => isSelectableNoteDate(note, date)}
      footer={
        <>
          {describeNoteRecurrence(note)}
          {!hasAnyDate && <span className="block text-red-600">No dates available for this schedule.</span>}
        </>
      }
    />
  );
}
