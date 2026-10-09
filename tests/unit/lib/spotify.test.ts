import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  spotifySearchUrl,
  spotifySongSearchUrl,
} from '@/lib/spotify';

describe('spotify.ts', () => {
  describe('spotifySearchUrl', () => {
    it('encodes the query', () => {
      expect(spotifySearchUrl('hello world')).toBe(
        'https://open.spotify.com/search/hello%20world',
      );
    });

    it('appends the type when provided', () => {
      expect(spotifySearchUrl('abc', 'tracks')).toBe(
        'https://open.spotify.com/search/abc/tracks',
      );
      expect(spotifySearchUrl('abc', 'albums')).toBe(
        'https://open.spotify.com/search/abc/albums',
      );
      expect(spotifySearchUrl('abc', 'artists')).toBe(
        'https://open.spotify.com/search/abc/artists',
      );
    });

    it('omits the type when not provided', () => {
      expect(spotifySearchUrl('abc')).toBe('https://open.spotify.com/search/abc');
    });
  });

  describe('spotifySongSearchUrl', () => {
    it('combines artist and title', () => {
      expect(spotifySongSearchUrl('Amazing Grace', 'John Newton')).toBe(
        'https://open.spotify.com/search/John%20Newton%20Amazing%20Grace/tracks',
      );
    });

    it('works without an artist', () => {
      expect(spotifySongSearchUrl('Amazing Grace')).toBe(
        'https://open.spotify.com/search/Amazing%20Grace/tracks',
      );
    });

    it('ignores an empty artist string', () => {
      expect(spotifySongSearchUrl('Amazing Grace', '')).toBe(
        'https://open.spotify.com/search/Amazing%20Grace/tracks',
      );
    });
  });
});
