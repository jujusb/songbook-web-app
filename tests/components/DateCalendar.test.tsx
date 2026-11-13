import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, cleanup } from '../setup/test-utils';
import { DateCalendar } from '@/components/DateCalendar';

const dates = () => Array.from(document.querySelectorAll('button[data-date]')).map((b) => b.getAttribute('data-date'));

describe('DateCalendar', () => {
  afterEach(() => cleanup());

  it('makes only selectable days clickable', () => {
    renderWithProviders(
      <DateCalendar value="2026-11-01" onChange={() => {}} isSelectable={(d) => d.endsWith('-08')} />,
    );
    expect(screen.getByTestId('calendar-month')).toHaveTextContent('November 2026');
    expect(dates()).toEqual(['2026-11-08']);
  });

  it('shows a dot on days with saved data and reports clicks', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DateCalendar
        value="2026-11-01"
        onChange={onChange}
        isSelectable={() => true}
        marked={new Set(['2026-11-15'])}
      />,
    );
    const marked = screen.getByRole('button', { name: '2026-11-15' });
    expect(marked.querySelector('span[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: '2026-11-02' }).querySelector('span[aria-hidden="true"]')).toBeNull();
    fireEvent.click(marked);
    expect(onChange).toHaveBeenCalledWith('2026-11-15');
  });

  it('navigates months', () => {
    renderWithProviders(<DateCalendar value="2026-11-01" onChange={() => {}} isSelectable={() => true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByTestId('calendar-month')).toHaveTextContent('December 2026');
  });
});
