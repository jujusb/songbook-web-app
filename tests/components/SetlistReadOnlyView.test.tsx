import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '../setup/test-utils';
import { SetlistReadOnlyView } from '@/components/SetlistReadOnlyView';

const song = {
  songId: 'song-1',
  lang: 'en',
  title: 'Test Song',
  translations: ['en'],
  body: '{start_of_verse}\n[C]Hello [G]world\n{end_of_verse}',
};

const basePreferences = {
  showChords: false,
  showRepeats: true,
  chordNotation: 'letters' as const,
  inlineChords: false,
  setlistLyricsView: 'list' as 'all' | 'list',
  setlistTranspose: {},
};

function renderMode(mode: string, preferences = basePreferences) {
  return renderWithProviders(
    <SetlistReadOnlyView
      songs={[song]}
      userPreferences={preferences}
      songBodies={{}}
      isReference={false}
      sourceSetlistId="test-setlist"
      voiceShares={[]}
      canGenerate={false}
      mode={mode}
    />
  );
}

describe('SetlistReadOnlyView modes', () => {
  it('public mode always shows lyrics without chords and ignores user preferences', () => {
    const { container } = renderMode('public', {
      ...basePreferences,
      showChords: true,
      setlistLyricsView: 'list',
    });

    expect(screen.getByText(/Hello world/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /transpose up/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /display options/i })).not.toBeInTheDocument();
    expect(container.querySelector('.visual-chord-sheet')).toHaveClass('hide-chords');
  });

  it('guitarist mode always shows chords and ignores user preferences', () => {
    const { container } = renderMode('guitarist', {
      ...basePreferences,
      showChords: false,
      setlistLyricsView: 'list',
    });

    expect(screen.getByText(/Hello world/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /transpose up/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /display options/i })).not.toBeInTheDocument();
    expect(container.querySelector('.visual-chord-sheet')).not.toHaveClass('hide-chords');
  });

  it('default mode follows the user preferences', () => {
    const { container } = renderMode('default', {
      ...basePreferences,
      showChords: false,
      setlistLyricsView: 'list',
    });

    expect(screen.queryByText(/Hello world/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /display options/i })).toBeInTheDocument();
    expect(container.querySelector('.visual-chord-sheet')).toBeNull();
  });

  it('default mode expands lyrics when the user prefers the all view', () => {
    const { container } = renderMode('default', {
      ...basePreferences,
      showChords: true,
      setlistLyricsView: 'all',
    });

    expect(screen.getByText(/Hello world/)).toBeInTheDocument();
    expect(container.querySelector('.visual-chord-sheet')).not.toHaveClass('hide-chords');
  });
});
