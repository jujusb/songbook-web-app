import { describe, it, expect } from 'vitest';
import {
  addDaysIso,
  isSelectableNoteDate,
  selectableNoteDates,
} from '@/lib/note-schedule';

const weekly = (schedule: string) => ({ recurrent_type: 'weekly', recurrent_schedule: schedule });
const monthly = (schedule: string) => ({ recurrent_type: 'monthly', recurrent_schedule: schedule });

describe('isSelectableNoteDate', () => {
  it('daily allows every valid date', () => {
    expect(isSelectableNoteDate({ recurrent_type: 'daily' }, '2026-11-12')).toBe(true);
  });

  it('weekly only allows the chosen weekday', () => {
    // 2026-11-15 is a Sunday, 2026-11-16 a Monday.
    expect(isSelectableNoteDate(weekly('sunday'), '2026-11-15')).toBe(true);
    expect(isSelectableNoteDate(weekly('sunday'), '2026-11-16')).toBe(false);
    expect(isSelectableNoteDate(weekly('monday'), '2026-11-16')).toBe(true);
  });

  it('weekly with a non-weekday schedule allows nothing', () => {
    expect(isSelectableNoteDate(weekly('first'), '2026-11-15')).toBe(false);
  });

  it('monthly first allows only the first Sunday', () => {
    // Nov 2026: Sundays are 1, 8, 15, 22, 29.
    expect(isSelectableNoteDate(monthly('first'), '2026-11-01')).toBe(true);
    expect(isSelectableNoteDate(monthly('first'), '2026-11-08')).toBe(false);
    expect(isSelectableNoteDate(monthly('first'), '2026-11-15')).toBe(false);
    expect(isSelectableNoteDate(monthly('first'), '2026-11-02')).toBe(false);
  });

  it('monthly first-second allows the first and second Sundays', () => {
    // Nov 1 = first Sunday, Nov 8 = second Sunday, Nov 15 = third.
    expect(isSelectableNoteDate(monthly('first-second'), '2026-11-01')).toBe(true);
    expect(isSelectableNoteDate(monthly('first-second'), '2026-11-08')).toBe(true);
    expect(isSelectableNoteDate(monthly('first-second'), '2026-11-15')).toBe(false);
  });

  it('monthly last allows the last calendar day of each month, including leap February', () => {
    expect(isSelectableNoteDate(monthly('last'), '2026-11-30')).toBe(true);
    expect(isSelectableNoteDate(monthly('last'), '2026-11-29')).toBe(false);
    expect(isSelectableNoteDate(monthly('last'), '2028-02-29')).toBe(true);
    expect(isSelectableNoteDate(monthly('last'), '2028-02-28')).toBe(false);
    expect(isSelectableNoteDate(monthly('last'), '2026-02-28')).toBe(true);
  });

  it('specific-dates allows only published dates', () => {
    const note = { recurrent_type: 'specific-dates', publishedDates: ['2026-12-24'] };
    expect(isSelectableNoteDate(note, '2026-12-24')).toBe(true);
    expect(isSelectableNoteDate(note, '2026-12-25')).toBe(false);
  });

  it('rejects malformed and impossible dates', () => {
    expect(isSelectableNoteDate({ recurrent_type: 'daily' }, '2026-02-30')).toBe(false);
    expect(isSelectableNoteDate({ recurrent_type: 'daily' }, '2026-1-5')).toBe(false);
    expect(isSelectableNoteDate({ recurrent_type: 'daily' }, '')).toBe(false);
  });

  it('ignores periodic behavior (not part of the rule)', () => {
    const note = { recurrent_type: 'weekly', recurrent_schedule: 'sunday' };
    expect(isSelectableNoteDate(note, '2026-11-15')).toBe(true);
  });
});

describe('selectableNoteDates', () => {
  it('lists the matching dates in a range, ascending', () => {
    expect(selectableNoteDates(monthly('first'), '2026-11-01', '2026-12-31')).toEqual([
      '2026-11-01',
      '2026-12-06',
    ]);
  });

  it('returns only published dates for specific-dates notes', () => {
    const note = { recurrent_type: 'specific-dates', publishedDates: ['2026-12-25', '2026-06-01', 'bad'] };
    expect(selectableNoteDates(note, '2026-01-01', '2026-12-31')).toEqual(['2026-06-01', '2026-12-25']);
  });
});

describe('addDaysIso', () => {
  it('crosses month and year boundaries', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });
});
