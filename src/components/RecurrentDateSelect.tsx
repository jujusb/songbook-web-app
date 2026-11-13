"use client";

import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { DateCalendar } from "@/components/DateCalendar";
import {
  addDaysIso,
  isSelectableNoteDate,
  parseIsoDate,
  selectableNoteDates,
  WEEKDAY_SCHEDULES,
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

/** Localized, human-readable rule for the calendar footer. */
function describeRule(note: NoteMetadata, t: (key: string, params?: Record<string, string | number>) => string, locale: string): string {
  switch (note.recurrent_type) {
    case "daily":
      return t("dates.ruleDaily");
    case "specific-dates":
      return t("dates.ruleSpecific");
    case "weekly": {
      const index = WEEKDAY_SCHEDULES.indexOf(note.recurrent_schedule as (typeof WEEKDAY_SCHEDULES)[number]);
      if (index < 0) return note.recurrent_schedule ?? "";
      const day = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
        new Date(Date.UTC(2024, 0, 7 + index)),
      );
      return t("dates.ruleWeekly", { day });
    }
    case "monthly":
      if (note.recurrent_schedule === "first") return t("dates.ruleFirst");
      if (note.recurrent_schedule === "first-second") return t("dates.ruleFirstSecond");
      if (note.recurrent_schedule === "last") return t("dates.ruleLast");
      return t("dates.ruleMonthly");
    default:
      return "";
  }
}

/** Month calendar for a recurrent note: only dates its recurrence allows are clickable. */
export function RecurrentDateSelect({ note, value, onChange, autoCorrect = true }: RecurrentDateSelectProps) {
  const { t, locale } = useTranslation();
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
          {describeRule(note, t, locale)}
          {!hasAnyDate && <span className="block text-red-600">{t("dates.noDatesAvailable")}</span>}
        </>
      }
    />
  );
}
