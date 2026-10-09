import { describe, it, expect } from 'vitest';
import {
  partitionInstrumentOf,
  basenameWithoutExtension,
  slugify,
  decodeFileName,
} from '@/lib/partition-utils';

describe('partition-utils.ts', () => {
  describe('basenameWithoutExtension', () => {
    it('strips directories and the .pdf extension', () => {
      expect(basenameWithoutExtension('a/b/c.pdf')).toBe('c');
      expect(basenameWithoutExtension('c.PDF')).toBe('c');
      expect(basenameWithoutExtension('folder/My Song.pdf')).toBe('My Song');
    });

    it('handles names without a directory or extension', () => {
      expect(basenameWithoutExtension('plain')).toBe('plain');
      expect(basenameWithoutExtension('song.txt')).toBe('song.txt');
    });
  });

  describe('slugify', () => {
    it('strips accents and lowercases', () => {
      expect(slugify('Introducción')).toBe('introduccion');
      expect(slugify('Cuerdas')).toBe('cuerdas');
    });

    it('collapses punctuation and trims dashes', () => {
      expect(slugify('  Hello, World!  ')).toBe('hello-world');
      expect(slugify('---leading-and-trailing---')).toBe('leading-and-trailing');
    });

    it('returns empty string for symbols only', () => {
      expect(slugify('!!!')).toBe('');
      expect(slugify('')).toBe('');
    });
  });

  describe('decodeFileName', () => {
    it('decodes percent-encoded names', () => {
      expect(decodeFileName('Canci%C3%B3n')).toBe('Canción');
      expect(decodeFileName('a%20b')).toBe('a b');
    });

    it('returns the original string when decoding fails', () => {
      expect(decodeFileName('%E0%A4%A')).toBe('%E0%A4%A');
    });

    it('returns plain names unchanged', () => {
      expect(decodeFileName('plain')).toBe('plain');
    });
  });

  describe('partitionInstrumentOf', () => {
    it('extracts the instrument after the last separator in the title', () => {
      expect(partitionInstrumentOf({ title: 'My Song - Guitarra' })).toEqual({
        slug: 'guitarra',
        label: 'Guitarra',
      });
      expect(partitionInstrumentOf({ title: 'Song - Voice - Piano' })).toEqual({
        slug: 'piano',
        label: 'Piano',
      });
    });

    it('decodes the title and falls back to file basename', () => {
      expect(partitionInstrumentOf({ file: 'folder/Canci%C3%B3n%20-%20Piano.pdf' })).toEqual({
        slug: 'piano',
        label: 'Piano',
      });
    });

    it('uses the instrument folder when the title has no separator', () => {
      expect(
        partitionInstrumentOf({ title: 'Just a title', instrument: 'cuerdas', instrumentLabel: 'Cuerdas' }),
      ).toEqual({ slug: 'cuerdas', label: 'Cuerdas' });
    });

    it('uses the instrument slug when no label is provided', () => {
      expect(partitionInstrumentOf({ title: 'No sep', instrument: 'vientos' })).toEqual({
        slug: 'vientos',
        label: 'vientos',
      });
    });

    it('returns unknown when nothing is available', () => {
      expect(partitionInstrumentOf({})).toEqual({ slug: 'unknown', label: 'unknown' });
      expect(partitionInstrumentOf({ title: null, file: null })).toEqual({
        slug: 'unknown',
        label: 'unknown',
      });
    });

    it('ignores separators at the start or end of the title', () => {
      // separator at position 0 -> not parsed
      expect(partitionInstrumentOf({ title: '- Guitarra', instrument: 'otros' })).toEqual({
        slug: 'otros',
        label: 'otros',
      });
      // trailing separator -> nothing after it
      expect(partitionInstrumentOf({ title: 'Guitarra -', instrument: 'otros' })).toEqual({
        slug: 'otros',
        label: 'otros',
      });
    });

    it('handles en/em dashes as separators', () => {
      expect(partitionInstrumentOf({ title: 'Canción – Flauta' }).label).toBe('Flauta');
      expect(partitionInstrumentOf({ title: 'Canción — Cello' }).label).toBe('Cello');
    });

    it('returns null-parsed when the title is empty', () => {
      expect(partitionInstrumentOf({ title: '', instrument: 'otros' }).slug).toBe('otros');
    });
  });
});
