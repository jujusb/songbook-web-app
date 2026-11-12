/**
 * Date rules for recurrent notes. Pure functions only (no fs/server imports)
 * so both the setlist date picker (client) and setlist validation (server)
 * can use them.
 */

export type RecurrentType = 'weekly' | 'monthly' | 'specific-dates' | 'daily';

export interface RecurrenceRule {
  recurrent_type: RecurrentType | string;
  recurrent_schedule?: string;
  publishedDates?: string[];
}

export const WEEKDAY_SCHEDULES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const WEEKDAY_INDEX: Record<string, number> = Object.fromEntries(
  WEEKDAY_SCHEDULES.map((name, index) => [name, index]),
);

/** Schedules that are valid for each recurrent type. Empty = schedule is ignored. */
export const SCHEDULES_BY_TYPE: Record<RecurrentType, readonly string[]> = {
  weekly: WEEKDAY_SCHEDULES,
  monthly: ['first', 'first-second', 'last'],
  daily: [],
  'specific-dates': [],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a strict YYYY-MM-DD string into UTC components; null when invalid. */
export function parseIsoDate(value: string): { year: number; month: number; day: number; weekday: number } | null {
  if (!DATE_RE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day, weekday: date.getUTCDay() };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Whether a recurrent note may be used on the given calendar date. */
export function isSelectableNoteDate(note: RecurrenceRule, date: string): boolean {
  const parts = parseIsoDate(date);
  if (!parts) return false;

  switch (note.recurrent_type) {
    case 'daily':
      return true;
    case 'specific-dates':
      return (note.publishedDates ?? []).includes(date);
    case 'weekly': {
      const weekday = WEEKDAY_INDEX[note.recurrent_schedule ?? ''];
      return weekday !== undefined && parts.weekday === weekday;
    }
    case 'monthly': {
      if (note.recurrent_schedule === 'last') {
        return parts.day === daysInMonth(parts.year, parts.month);
      }
      if (note.recurrent_schedule === 'first') {
        return parts.weekday === 0 && parts.day <= 7;
      }
      if (note.recurrent_schedule === 'first-second') {
        return parts.weekday === 0 && parts.day <= 14;
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Selectable dates between `from` and `to` (inclusive, YYYY-MM-DD), ascending.
 * Specific-date notes only yield their published dates within the range.
 */
export function selectableNoteDates(note: RecurrenceRule, from: string, to: string): string[] {
  if (note.recurrent_type === 'specific-dates') {
    return [...new Set(note.publishedDates ?? [])]
      .filter((d) => d >= from && d <= to && isSelectableNoteDate(note, d))
      .sort();
  }
  const result: string[] = [];
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return result;
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const last = Date.UTC(end.year, end.month - 1, end.day);
  while (cursor.getTime() <= last) {
    const iso = cursor.toISOString().slice(0, 10);
    if (isSelectableNoteDate(note, iso)) result.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

/** Human-readable description of the rule, for hints in the UI. */
export function describeNoteRecurrence(note: RecurrenceRule): string {
  switch (note.recurrent_type) {
    case 'daily':
      return 'every day';
    case 'specific-dates':
      return 'published dates only';
    case 'weekly':
      return `every ${note.recurrent_schedule ?? ''}`;
    case 'monthly':
      if (note.recurrent_schedule === 'first') return 'first Sunday of the month';
      if (note.recurrent_schedule === 'first-second') return 'first and second Sunday of the month';
      if (note.recurrent_schedule === 'last') return 'last day of the month';
      return 'monthly';
    default:
      return '';
  }
}

/** Shift a YYYY-MM-DD date by a number of days (UTC arithmetic, no DST drift). */
export function addDaysIso(date: string, days: number): string {
  const parts = parseIsoDate(date);
  if (!parts) return date;
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return shifted.toISOString().slice(0, 10);
}
