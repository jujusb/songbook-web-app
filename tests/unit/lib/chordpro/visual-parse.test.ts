import { describe, it, expect } from 'vitest';
import {
  parseChordProLine,
  parseChordProSource,
  directiveLabel,
  lineToChordPro,
  linesToChordPro,
  isContentLine,
  buildSectionSpans,
  sectionForLine,
} from '@/lib/chordpro/visual-parse';

describe('chordpro/visual-parse.ts', () => {
  describe('parseChordProLine', () => {
    it('parses a plain lyric line', () => {
      const parsed = parseChordProLine('hello world');
      expect(parsed.type).toBe('content');
      expect(parsed.lyrics).toBe('hello world');
      expect(parsed.chords).toEqual([]);
    });

    it('parses inline chords with positions', () => {
      const parsed = parseChordProLine('[C]Hello [G]world');
      expect(parsed.lyrics).toBe('Hello world');
      expect(parsed.chords).toEqual([
        { chord: 'C', position: 0 },
        { chord: 'G', position: 6 },
      ]);
    });

    it('marks directive lines', () => {
      const parsed = parseChordProLine('{start_of_verse}');
      expect(parsed).toEqual({
        type: 'directive',
        raw: '{start_of_verse}',
        lyrics: '',
        chords: [],
      });
    });

    it('keeps an unclosed bracket as lyrics', () => {
      const parsed = parseChordProLine('[C');
      expect(parsed.type).toBe('content');
      expect(parsed.lyrics).toBe('[C');
      expect(parsed.chords).toEqual([]);
    });

    it('trims when detecting directives but keeps raw', () => {
      const parsed = parseChordProLine('  {title: X}  ');
      expect(parsed.type).toBe('directive');
      expect(parsed.raw).toBe('  {title: X}  ');
    });
  });

  describe('parseChordProSource', () => {
    it('splits a source into parsed lines', () => {
      const parsed = parseChordProSource('[C]One\n{verse}\nTwo');
      expect(parsed).toHaveLength(3);
      expect(parsed[0].chords[0].chord).toBe('C');
      expect(parsed[1].type).toBe('directive');
      expect(parsed[2].lyrics).toBe('Two');
    });
  });

  describe('directiveLabel', () => {
    it('returns the explicit label for start_of directives', () => {
      expect(directiveLabel('{start_of_verse: Verse 1}')).toBe('Verse 1');
    });

    it('falls back to a title-cased type', () => {
      expect(directiveLabel('{start_of_chorus}')).toBe('Chorus');
      expect(directiveLabel('{start_of_bridge}')).toBe('Bridge');
    });

    it('returns null for end directives', () => {
      expect(directiveLabel('{end_of_verse}')).toBeNull();
      expect(directiveLabel('{e_chorus}')).toBeNull();
    });

    it('returns null for unrelated lines', () => {
      expect(directiveLabel('{title: X}')).toBeNull();
      expect(directiveLabel('[C]Hello')).toBeNull();
      expect(directiveLabel('hello')).toBeNull();
    });
  });

  describe('lineToChordPro', () => {
    it('passes directives through unchanged', () => {
      expect(lineToChordPro(parseChordProLine('{comment: hi}'))).toBe('{comment: hi}');
    });

    it('returns lyrics unchanged when there are no chords', () => {
      expect(lineToChordPro(parseChordProLine('just lyrics'))).toBe('just lyrics');
    });

    it('reinserts chords at their positions sorted from the end', () => {
      const parsed = {
        type: 'content' as const,
        raw: 'hello world',
        lyrics: 'hello world',
        chords: [
          { chord: 'C', position: 0 },
          { chord: 'G', position: 6 },
        ],
      };
      expect(lineToChordPro(parsed)).toBe('[C]hello [G]world');
    });

    it('clamps out-of-range chord positions', () => {
      const parsed = {
        type: 'content' as const,
        raw: 'hi',
        lyrics: 'hi',
        chords: [{ chord: 'C', position: 100 }],
      };
      expect(lineToChordPro(parsed)).toBe('hi[C]');
    });
  });

  describe('linesToChordPro', () => {
    it('joins parsed lines with newlines', () => {
      const lines = parseChordProSource('[C]One\nTwo');
      expect(linesToChordPro(lines)).toBe('[C]One\nTwo');
    });
  });

  describe('isContentLine', () => {
    it('is true for lyric and chord-only content lines', () => {
      expect(isContentLine(parseChordProLine('lyric'))).toBe(true);
      expect(isContentLine(parseChordProLine('[C]'))).toBe(true);
    });

    it('is false for directives and blank lines', () => {
      expect(isContentLine(parseChordProLine('{verse}'))).toBe(false);
      expect(isContentLine(parseChordProLine('   '))).toBe(false);
    });
  });

  describe('buildSectionSpans', () => {
    it('maps explicit sections to content-line spans', () => {
      const source = [
        '{start_of_verse: Verse 1}',
        '[C]Hello',
        '{end_of_verse}',
        '{start_of_chorus}',
        'Chorus line',
      ].join('\n');

      const spans = buildSectionSpans(source);

      expect(spans).toEqual([
        { type: 'verse', label: 'Verse 1', startLine: 0, endLine: 0 },
        { type: 'chorus', label: 'Chorus', startLine: 1, endLine: 1 },
      ]);
    });

    it('closes unclosed sections at the end of the source', () => {
      const source = '{start_of_verse: V}\nLine one\nLine two';
      const spans = buildSectionSpans(source);
      expect(spans).toEqual([
        { type: 'verse', label: 'V', startLine: 0, endLine: 1 },
      ]);
    });

    it('handles nested sections', () => {
      const source = [
        '{start_of_verse: V}',
        'A',
        '{start_of_chorus: C}',
        'B',
        '{end_of_chorus}',
        'C',
        '{end_of_verse}',
      ].join('\n');

      const spans = buildSectionSpans(source);
      const types = spans.map((s) => s.type);
      expect(types).toContain('chorus');
      expect(types).toContain('verse');
    });

    it('ignores stray end directives without a matching start', () => {
      const spans = buildSectionSpans('{end_of_verse}\nLine');
      expect(spans).toEqual([]);
    });

    it('ignores non-section directives', () => {
      const spans = buildSectionSpans('{title: X}\nLine');
      expect(spans).toEqual([]);
    });
  });

  describe('sectionForLine', () => {
    const spans = [
      { type: 'verse', label: 'V1', startLine: 0, endLine: 1 },
      { type: 'chorus', label: 'C', startLine: 2, endLine: 3 },
    ];

    it('finds the section containing a line', () => {
      expect(sectionForLine(spans, 0)).toEqual({ type: 'verse', label: 'V1' });
      expect(sectionForLine(spans, 3)).toEqual({ type: 'chorus', label: 'C' });
    });

    it('returns null for lines outside every section', () => {
      expect(sectionForLine(spans, 10)).toBeNull();
    });
  });
});
