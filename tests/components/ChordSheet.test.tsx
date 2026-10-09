import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../setup/test-utils';
import { ChordSheet } from '@/components/ChordSheet';

const mockReferences = [
  {
    type: 'song',
    label: 'Reference Song',
    target: 'ref-song',
    verse: '1',
    text: 'Referenced verse text',
    highlight: 'referenced',
  },
  {
    type: 'link',
    label: 'External Link',
    target: 'https://example.com',
    text: 'Link description',
  },
];

const sampleSource = `{title: Test Song}
{key: C}
{capo: 2}

{start_of_verse: 1}
[C]Amazing [G]grace how [Am]sweet the [F]sound
{end_of_verse}

{start_of_chorus}
[F]Saved a [G]wretch like [C]me
{end_of_chorus}

{start_of_verse: 2}
[C]Twas [G]grace that [Am]taught my [F]heart to [C]fear
{end_of_verse}`;

describe('ChordSheet Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders chord sheet with sections', () => {
    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" songCapo={2} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Chorus')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Amazing grace how sweet the sound/)).toBeInTheDocument();
  });

  it('displays transpose controls', () => {
    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" />);

    expect(screen.getByRole('button', { name: /transpose down/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /transpose up/i })).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // Initial semitones
  });

  it('transposes chords when buttons clicked', () => {
    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" />);

    const upButton = screen.getByRole('button', { name: /transpose up/i });
    fireEvent.click(upButton);
    fireEvent.click(upButton); // +2 semitones

    expect(screen.getByText('+2')).toBeInTheDocument();

    // Chord sheet should still render after transposition
    expect(screen.getByText(/Amazing grace how sweet the sound/)).toBeInTheDocument();
  });

  it('shows reset button when transposed', () => {
    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" />);

    const upButton = screen.getByRole('button', { name: /transpose up/i });
    fireEvent.click(upButton);

    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('hides reset button when not transposed', () => {
    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" />);

    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();
  });

  it('displays original key and capo', () => {
    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" songCapo={2} />);

    expect(screen.getByText(/original key.*c/i)).toBeInTheDocument();
    expect(screen.getByText(/capo 2/i)).toBeInTheDocument();
  });

  it('toggles repeat sections', () => {
    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" repeatChorus={true} />);

    const toggleButton = screen.getByRole('button', { name: /hide repeats/i });
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByRole('button', { name: /show repeats/i })).toBeInTheDocument();
  });

  it('renders references with footnotes', () => {
    renderWithProviders(<ChordSheet
      initialSource={sampleSource}
      songKey="C"
      references={mockReferences}
    />);

    expect(screen.getByText('References')).toBeInTheDocument();
    expect(screen.getByText('Reference Song')).toBeInTheDocument();
    expect(screen.getByText('External Link')).toBeInTheDocument();
  });

  it('displays reference highlights', () => {
    renderWithProviders(<ChordSheet
      initialSource={sampleSource}
      songKey="C"
      references={mockReferences}
      lang="en"
    />);

    // The reference text with highlight should be visible
    expect(screen.getByText('Referenced verse text')).toBeInTheDocument();
  });

  it('renders inline chords on mobile', () => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });

    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" />);

    expect(screen.getByText(/Amazing grace how sweet the sound/)).toBeInTheDocument();
  });

  it('handles empty references', () => {
    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" references={[]} />);

    expect(screen.queryByText('References')).not.toBeInTheDocument();
  });

  it('renders general references separately', () => {
    const generalRefs = [
      {
        type: 'song',
        label: 'General Song',
        target: 'general-song',
        text: 'General reference text',
      },
    ];

    renderWithProviders(<ChordSheet
      initialSource={sampleSource}
      songKey="C"
      references={[mockReferences[0], ...generalRefs]}
    />);

    expect(screen.getByText('See Also')).toBeInTheDocument();
    expect(screen.getByText('General Song')).toBeInTheDocument();
  });

  it('applies idPrefix to footnote links', () => {
    renderWithProviders(<ChordSheet
      initialSource={sampleSource}
      songKey="C"
      references={mockReferences}
      idPrefix="song-123"
    />);

    // Check that footnote links use the prefix
    const links = screen.getAllByRole('link', { name: /\(\d+\)/ });
    expect(links.length).toBeGreaterThan(0);
    links.forEach(link => {
      expect(link.getAttribute('href')).toContain('song-123-ref-');
    });
  });
});
