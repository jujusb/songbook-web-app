import { describe, it, expect } from 'vitest';
import {
  slugifySongId,
  stripFileExtension,
  songIdFromTitle,
  uniqueSongId,
} from '@/lib/song-ids';

describe('song-ids.ts', () => {
  describe('slugifySongId', () => {
    it('lowercases and dashes non-alphanumerics', () => {
      expect(slugifySongId('Amazing Grace')).toBe('amazing-grace');
      expect(slugifySongId('  Hello, World!  ')).toBe('hello-world');
      expect(slugifySongId('Song #1')).toBe('song-1');
    });

    it('collapses repeated separators and trims dashes', () => {
      expect(slugifySongId('a---b___c')).toBe('a-b-c');
      expect(slugifySongId('---x---')).toBe('x');
    });

    it('returns empty for strings with no ascii alphanumerics', () => {
      expect(slugifySongId('日本')).toBe('');
      expect(slugifySongId('!!!')).toBe('');
    });
  });

  describe('stripFileExtension', () => {
    it('removes the last extension', () => {
      expect(stripFileExtension('Amazing Grace.docx')).toBe('Amazing Grace');
      expect(stripFileExtension('a.b.pdf')).toBe('a.b');
    });

    it('leaves names without an extension unchanged', () => {
      expect(stripFileExtension('noext')).toBe('noext');
    });
  });

  describe('songIdFromTitle', () => {
    it('derives an id from the title', () => {
      expect(songIdFromTitle('Amazing Grace', 'whatever.doc')).toBe('amazing-grace');
    });

    it('falls back to the file name when the title has no ascii', () => {
      expect(songIdFromTitle('日本', 'Grace.docx')).toBe('grace');
    });

    it('falls back to "song" when neither yields an id', () => {
      expect(songIdFromTitle('日本', '日本.docx')).toBe('song');
    });
  });

  describe('uniqueSongId', () => {
    it('returns the base when unused and records it', () => {
      const taken = new Set<string>();
      expect(uniqueSongId('song', taken)).toBe('song');
      expect(taken.has('song')).toBe(true);
    });

    it('appends an incrementing suffix when taken', () => {
      const taken = new Set<string>(['song', 'song-2']);
      expect(uniqueSongId('song', taken)).toBe('song-3');
      expect(taken.has('song-3')).toBe(true);
    });

    it('keeps repeated calls unique', () => {
      const taken = new Set<string>();
      const first = uniqueSongId('x', taken);
      const second = uniqueSongId('x', taken);
      expect(first).toBe('x');
      expect(second).toBe('x-2');
    });
  });
});
