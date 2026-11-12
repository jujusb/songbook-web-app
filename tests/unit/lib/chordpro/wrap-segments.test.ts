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
    expect(html).toContain('<span class="vce-seg"><span class="vce-chord">C</span>');
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
    expect(html).toContain('<span class="vce-lyrics-text">example of </span>');
    expect(html).not.toContain('>ex</span>');
  });

  it('keeps a chord at a word boundary where it was', () => {
    const html = renderVisualChordSheet('Hello [G]world', { wrapSegments: true });
    expect(html).toContain('<span class="vce-lyrics-text">Hello </span>');
    expect(html).toContain('<span class="vce-lyrics-text">world</span>');
  });
});

describe('renderVisualChordSheet wrapSegments spaces', () => {
  it('does not start a segment with the space a chord sits on', () => {
    const html = renderVisualChordSheet('Hello[G] world', { wrapSegments: true });
    expect(html).toContain('<span class="vce-lyrics-text">Hello </span>');
    expect(html).toContain('<span class="vce-chord">G</span>');
    expect(html).toContain('<span class="vce-lyrics-text">world</span>');
    expect(html).not.toContain('<span class="vce-lyrics-text"> world</span>');
  });
});

describe('renderVisualChordSheet chord row on spaces', () => {
  it('draws a chord on a space over the next word in the non-wrapped row', () => {
    const html = renderVisualChordSheet('Hello[G] world', {});
    // "Hello" is 5 characters, so the chord row starts the chord at column 6 (the "w").
    expect(html).toContain('<span class="vce-chord-space">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="vce-chord">G</span>');
  });
});

describe('renderVisualChordSheet wrapSegments reading order', () => {
  it('puts each chord before its lyric in the markup', () => {
    const html = renderVisualChordSheet('[G]Hello [A]world', { wrapSegments: true });
    const g = html.indexOf('>G</span>');
    const hello = html.indexOf('Hello');
    const a = html.indexOf('>A</span>');
    const world = html.indexOf('world');
    expect(g).toBeLessThan(hello);
    expect(hello).toBeLessThan(a);
    expect(a).toBeLessThan(world);
  });
});
