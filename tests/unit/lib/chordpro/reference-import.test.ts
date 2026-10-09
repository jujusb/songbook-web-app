import { describe, it, expect } from 'vitest';
import {
  parseReferenceLine,
  parseReferences,
} from '@/lib/chordpro/reference-import';

describe('chordpro/reference-import.ts', () => {
  describe('parseReferenceLine', () => {
    it('returns null for empty and comment lines', () => {
      expect(parseReferenceLine('')).toBeNull();
      expect(parseReferenceLine('   ')).toBeNull();
      expect(parseReferenceLine('# a comment')).toBeNull();
      expect(parseReferenceLine('// a comment')).toBeNull();
    });

    it('returns null when there are fewer than two fields', () => {
      expect(parseReferenceLine('bible')).toBeNull();
      expect(parseReferenceLine('bible | John 3:16')).not.toBeNull();
    });

    it('returns null for unknown reference types', () => {
      expect(parseReferenceLine('podcast | Episode 1 | https://x')).toBeNull();
    });

    it('parses a minimal bible reference', () => {
      const ref = parseReferenceLine('bible | John 3:16 | Jn 3,16');
      expect(ref).toEqual({
        type: 'bible',
        label: 'John 3:16',
        target: 'Jn 3,16',
      });
    });

    it('parses a song reference', () => {
      const ref = parseReferenceLine('song | See also | amazing-grace');
      expect(ref).toEqual({
        type: 'song',
        label: 'See also',
        target: 'amazing-grace',
      });
    });

    it('parses link, audio, video and image types', () => {
      expect(parseReferenceLine('link | Site | https://example.com')?.type).toBe('link');
      expect(parseReferenceLine('audio | Track | t.mp3')?.type).toBe('audio');
      expect(parseReferenceLine('video | Clip | c.mp4')?.type).toBe('video');
      expect(parseReferenceLine('image | Art | art.png')?.type).toBe('image');
    });

    it('captures text and highlight fields', () => {
      const ref = parseReferenceLine(
        'bible | John 3:16 | Jn 3,16 | line: 2 | For God so loved | God',
      );
      expect(ref?.text).toBe('For God so loved');
      expect(ref?.highlight).toBe('God');
      expect(ref?.line).toBe(2);
    });

    it('parses a single verse position', () => {
      const ref = parseReferenceLine('bible | John | Jn | verse: 2');
      expect(ref?.verse).toBe('2');
      expect(ref?.locations).toBeUndefined();
    });

    it('parses a single chorus position', () => {
      const ref = parseReferenceLine('bible | John | Jn | chorus: A');
      expect(ref?.chorus).toBe('A');
      expect(ref?.locations).toBeUndefined();
    });

    it('parses multiple positions into locations', () => {
      const ref = parseReferenceLine(
        'bible | John | Jn | verse: 1, verse: 2, line: 5',
      );
      expect(ref?.locations).toHaveLength(3);
      expect(ref?.locations?.[0]).toEqual({ verse: '1' });
      expect(ref?.locations?.[1]).toEqual({ verse: '2' });
      expect(ref?.locations?.[2]).toEqual({ line: 5 });
      expect(ref?.verse).toBeUndefined();
    });

    it('de-duplicates repeated verse positions', () => {
      const ref = parseReferenceLine('bible | John | Jn | verse: 1, verse: 1');
      expect(ref?.verse).toBe('1');
      expect(ref?.locations).toBeUndefined();
    });

    it('supports case-insensitive and = separated positions', () => {
      const ref = parseReferenceLine('bible | John | Jn | VErse=3');
      expect(ref?.verse).toBe('3');
      const ref2 = parseReferenceLine('bible | John | Jn | LINE=7');
      expect(ref2?.line).toBe(7);
    });

    it('ignores unparseable position fragments', () => {
      const ref = parseReferenceLine('bible | John | Jn | nothing here');
      expect(ref?.locations).toBeUndefined();
      expect(ref?.line).toBeUndefined();
    });

    it('trims surrounding whitespace and mixed-case type', () => {
      const ref = parseReferenceLine('  BIBLE |  John  |  Jn  ');
      expect(ref?.type).toBe('bible');
      expect(ref?.label).toBe('John');
      expect(ref?.target).toBe('Jn');
    });

    it('defaults the target to an empty string when absent', () => {
      const ref = parseReferenceLine('text | Note');
      expect(ref?.target).toBe('');
    });
  });

  describe('parseReferences', () => {
    it('parses multiple lines and filters invalid ones', () => {
      const text = [
        '# header',
        'bible | John | Jn',
        '',
        'bogus | nope',
        'song | See | amazing-grace',
      ].join('\n');

      const refs = parseReferences(text);

      expect(refs).toHaveLength(2);
      expect(refs[0].label).toBe('John');
      expect(refs[1].label).toBe('See');
    });

    it('returns an empty array when nothing parses', () => {
      expect(parseReferences('# nothing\n// here')).toEqual([]);
    });
  });
});
