import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, act, cleanup } from '../setup/test-utils';
import { PresentationView } from '@/components/PresentationView';

const backMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock }),
}));

const source = `{start_of_verse: 1}
Line one
{end_of_verse}
{start_of_chorus}
Line two
{end_of_chorus}`;

function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  });
  return store;
}

describe('PresentationView auto-advance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installLocalStorage();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function renderSong() {
    return renderWithProviders(
      <PresentationView songId="song" title="Song" source={source} isAudience={false} />
    );
  }

  it('advances automatically at the default speed', () => {
    renderSong();
    expect(screen.getByTestId('presentation-progress')).toHaveTextContent('1 / 2');

    fireEvent.click(screen.getByRole('button', { name: 'Auto OFF' }));
    expect(screen.getByRole('button', { name: 'Auto ON' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByTestId('presentation-progress')).toHaveTextContent('2 / 2');
  });

  it('uses the selected speed and remembers it', () => {
    renderSong();

    fireEvent.change(screen.getByLabelText('Auto-advance speed'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Auto OFF' }));

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByTestId('presentation-progress')).toHaveTextContent('1 / 2');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('presentation-progress')).toHaveTextContent('2 / 2');
    expect(localStorage.getItem('songbook-presentation-auto-delay')).toBe('3');
  });

  it('moves to the next song in a setlist', () => {
    renderWithProviders(
      <PresentationView
        songId="one"
        title="One"
        source={source}
        isAudience={false}
        setlistSongs={[
          { songId: 'one', title: 'One', source },
          { songId: 'two', title: 'Two', source },
        ]}
        setlistTitle="Set"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Auto OFF' }));

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByTestId('presentation-progress')).toHaveTextContent('Song 1/2');

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByTestId('presentation-progress')).toHaveTextContent('Song 2/2');
    expect(screen.getByTestId('presentation-progress')).toHaveTextContent('1 / 2');
  });

  it('stops at the last section', () => {
    renderSong();

    fireEvent.click(screen.getByRole('button', { name: 'Auto OFF' }));

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(screen.getByTestId('presentation-progress')).toHaveTextContent('2 / 2');
  });
});
