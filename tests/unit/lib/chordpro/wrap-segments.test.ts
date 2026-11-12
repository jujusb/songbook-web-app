import { describe, it, expect } from 'vitest';
import { renderVisualChordSheet } from '@/lib/chordpro/visual-render';

const source = '[C]Hello [G]world [Am]again';

describe('renderVisualChordSheet wrapSegments', () => {
  it('emits one chord-over-lyric segment per chord', () => {
    const html = renderVisualChordSheet(source, { wrapSegments: true });
    expect(html.match(/class="vce-seg"/g)).toHaveLength(3);
    expect(html).toContain('<span class="vce-chord">C</span>');
    expect(html).toContain('<span class="vce-chord">G</span>');
    expect(html).toContain('<span class="vce-chord">Am</span>');
    expect(html).not.toContain('vce-chord-space');
  });

  it('keeps leading lyrics before the first chord in an empty-chord segment', () => {
    const html = renderVisualChordSheet('Intro [C]line', { wrapSegments: true });
    expect(html.match(/class="vce-seg"/g)).toHaveLength(2);
    expect(html).toContain('Intro ');
  });

  it('hides chord rows but keeps lyrics when chords are hidden', () => {
    const html = renderVisualChordSheet(source, { wrapSegments: true, showChords: false });
    expect(html).not.toContain('vce-chord-row');
    expect(html).toContain('Hello ');
  });

  it('highlights a range across segment boundaries', () => {
    const html = renderVisualChordSheet(source, {
      wrapSegments: true,
      highlightRange: { line: 0, start: 4, end: 9 },
    });
    expect(html).toContain('<mark class="vce-ref-select">o </mark>');
    expect(html).toContain('<mark class="vce-ref-select">wor</mark>');
  });
});

describe('renderVisualChordSheet wrapSegments word boundaries', () => {
  it('does not split a word when a chord sits inside it', () => {
    const html = renderVisualChordSheet('ex[A]ample of [G]text', { wrapSegments: true });
    expect(html).toContain('<div class="vce-lyrics-text">example of </div>');
    expect(html).not.toContain('>ex</div>');
  });

  it('keeps a chord at a word boundary where it was', () => {
    const html = renderVisualChordSheet('Hello [G]world', { wrapSegments: true });
    expect(html).toContain('<div class="vce-lyrics-text">Hello </div>');
    expect(html).toContain('<div class="vce-lyrics-text">world</div>');
  });
});

describe('renderVisualChordSheet wrapSegments spaces', () => {
  it('does not start a segment with the space a chord sits on', () => {
    const html = renderVisualChordSheet('Hello[G] world', { wrapSegments: true });
    expect(html).toContain('<div class="vce-lyrics-text">Hello </div>');
    expect(html).toContain('<span class="vce-chord">G</span>');
    expect(html).toContain('<div class="vce-lyrics-text">world</div>');
    expect(html).not.toContain('<div class="vce-lyrics-text"> world</div>');
  });
});
