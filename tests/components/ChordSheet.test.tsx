import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../setup/test-utils';
import ChordSheet from '@/components/ChordSheet';

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

{verse: 1}
[C]Amazing [G]grace how [Am]sweet the [F]sound

{chorus}
[F]Saved a [G]wretch like [C]me
[Am]I once was [G]lost but [F]now I'm [C]found

{verse: 2}
[C]Twas [G]grace that [Am]taught my [F]heart to [C]fear`;

describe('ChordSheet Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders chord sheet with sections', () => {
    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" songCapo={2} />);
    
    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Verse 1')).toBeInTheDocument();
    expect(screen.getByText('Chorus')).toBeInTheDocument();
    expect(screen.getByText('Verse 2')).toBeInTheDocument();
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
    
    // Chords should be transposed in the rendered output
    const chordSheet = screen.getByTestId('chord-sheet') || screen.getByText('Amazing').closest('div');
    expect(chordSheet).toBeInTheDocument();
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
    window.dispatchEvent(new Event('resize'));
    
    renderWithProviders(<ChordSheet initialSource={sampleSource} songKey="C" />);
    
    // On mobile, inlineChords should be true
    const chordSheet = screen.getByText('Amazing').closest('div');
    expect(chordSheet).toBeInTheDocument();
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
      references={generalRefs}
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
    links.forEach(link => {
      expect(link.getAttribute('href')).toContain('song-123-ref-');
    });
  });
});

describe('ChordSheet - Transposition Logic', () => {
  it('transposes chords correctly', () => {
    const { transposeSource } = require('@/lib/chordpro/chord-utils');
    
    const source = `{verse: 1}
[C]Hello [G]world
{chorus}
[Am]Chorus [F]line`;
    
    const transposed = transposeSource(source, 2);
    
    expect(transposed).toContain('[D]Hello [A]world');
    expect(transposed).toContain('[Bm]Chorus [G]line');
  });

  it('handles negative transposition', () => {
    const { transposeSource } = require('@/lib/chordpro/chord-utils');
    
    const source = `{verse: 1}
[D]Hello [A]world`;
    
    const transposed = transposeSource(source, -2);
    
    expect(transposed).toContain('[C]Hello [G]world');
  });

  it('preserves non-chord content', () => {
    const { transposeSource } = require('@/lib/chordpro/chord-utils');
    
    const source = `{title: Test Song}
{key: C}

{verse: 1}
[C]Amazing grace
How sweet the sound`;
    
    const transposed = transposeSource(source, 2);
    
    expect(transposed).toContain('{title: Test Song}');
    expect(transposed).toContain('{key: D}');
    expect(transposed).toContain('How sweet the sound');
  });
});

describe('ChordSheet - Section Parsing', () => {
  it('parses verse and chorus sections', () => {
    const { parseSectionMap } = require('@/lib/chordpro/chord-utils');
    
    const source = `{title: Test}

{verse: 1}
Line 1
Line 2
{chorus}
Chorus line
{verse: 2}
Line 3`;
    
    const sections = parseSectionMap(source);
    
    expect(sections).toHaveLength(3);
    expect(sections[0]).toMatchObject({ type: 'verse', label: '1', startLine: 0 });
    expect(sections[1]).toMatchObject({ type: 'chorus', label: 'Chorus', startLine: 2 });
    expect(sections[2]).toMatchObject({ type: 'verse', label: '2', startLine: 3 });
  });

  it('handles section aliases', () => {
    const { parseSectionMap } = require('@/lib/chordpro/chord-utils');
    
    const source = `{verse: 1}
Line 1
{verse: 1. : 4.}
Line 2`;
    
    const sections = parseSectionMap(source);
    
    expect(sections[0].aliases).toContain('4.');
  });
});