import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, cleanup } from '../setup/test-utils';
import { RecurrentDateSelect, nearestAllowedNoteDate } from '@/components/RecurrentDateSelect';
import type { NoteMetadata } from '@/lib/notes';

const sundayNote = {
  id: 'sun',
  title: 'Sunday',
  language: 'en-US',
  recurrent_type: 'weekly',
  recurrent_schedule: 'sunday',
  periodic_behavior: 'same',
  sections: [],
  api_source: 'manual',
  api_sources: [],
  created: '2026-01-01T00:00:00.000Z',
  tags: [],
} as unknown as NoteMetadata;

const enabledDays = () =>
  Array.from(document.querySelectorAll('button[data-date]')).map((b) => b.getAttribute('data-date'));

describe('RecurrentDateSelect calendar', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('makes only the note\'s dates clickable (Sundays in November 2026)', () => {
    renderWithProviders(
      <RecurrentDateSelect note={sundayNote} value="2026-11-15" onChange={() => {}} />,
    );
    expect(screen.getByTestId('calendar-month')).toHaveTextContent('November 2026');
    expect(enabledDays()).toEqual(['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29']);
  });

  it('marks the selected date', () => {
    renderWithProviders(
      <RecurrentDateSelect note={sundayNote} value="2026-11-15" onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: '2026-11-15' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2026-11-22' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the clicked date', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <RecurrentDateSelect note={sundayNote} value="2026-11-15" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '2026-11-22' }));
    expect(onChange).toHaveBeenCalledWith('2026-11-22');
  });

  it('moves to the next month and shows its allowed dates', () => {
    renderWithProviders(
      <RecurrentDateSelect note={sundayNote} value="2026-11-15" onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByTestId('calendar-month')).toHaveTextContent('December 2026');
    expect(enabledDays()).toEqual(['2026-12-06', '2026-12-13', '2026-12-20', '2026-12-27']);
  });

  it('replaces a disallowed value with the nearest allowed date', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <RecurrentDateSelect note={sundayNote} value="2026-11-12" onChange={onChange} />,
    );
    expect(onChange).toHaveBeenCalledWith('2026-11-15');
  });

  it('keeps a disallowed value when autoCorrect is off', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <RecurrentDateSelect note={sundayNote} value="2026-11-12" onChange={onChange} autoCorrect={false} />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows no selectable days for specific-dates notes without dates', () => {
    const none = { ...sundayNote, recurrent_type: 'specific-dates', publishedDates: [] } as NoteMetadata;
    renderWithProviders(<RecurrentDateSelect note={none} value="2026-12-25" onChange={() => {}} />);
    expect(enabledDays()).toEqual([]);
    expect(screen.getByText(/No dates available/)).toBeInTheDocument();
  });

  it('finds the nearest allowed date for a monthly last-day rule', () => {
    const last = { ...sundayNote, recurrent_type: 'monthly', recurrent_schedule: 'last' } as NoteMetadata;
    expect(nearestAllowedNoteDate(last, '2026-11-20')).toBe('2026-11-30');
  });
});
