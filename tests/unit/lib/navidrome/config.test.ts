import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getNavidromeConfig, getVoicesConfig } from '@/lib/navidrome/config';

const NAV_KEYS = [
  'SONGBOOK_NAVIDROME_SONGS_URL',
  'SONGBOOK_NAVIDROME_USERNAME',
  'SONGBOOK_NAVIDROME_PASSWORD',
];

const VOICES_KEYS = [
  'SONGBOOK_VOICES_NAVIDROME_SONGS_URL',
  'SONGBOOK_VOICES_NAVIDROME_USERNAME',
  'SONGBOOK_VOICES_NAVIDROME_PASSWORD',
];

const ALL_KEYS = [...NAV_KEYS, ...VOICES_KEYS];

describe('navidrome/config', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of ALL_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ALL_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  describe('getNavidromeConfig', () => {
    it('returns null when no vars are set', () => {
      expect(getNavidromeConfig()).toBeNull();
    });

    it('returns null when only some vars are set', () => {
      process.env.SONGBOOK_NAVIDROME_SONGS_URL = 'https://nav.example.com';
      process.env.SONGBOOK_NAVIDROME_USERNAME = 'user';
      expect(getNavidromeConfig()).toBeNull();
    });

    it('returns the parsed config when all vars are valid', () => {
      process.env.SONGBOOK_NAVIDROME_SONGS_URL = 'https://nav.example.com';
      process.env.SONGBOOK_NAVIDROME_USERNAME = 'user';
      process.env.SONGBOOK_NAVIDROME_PASSWORD = 'secret';

      expect(getNavidromeConfig()).toEqual({
        songsUrl: 'https://nav.example.com',
        username: 'user',
        password: 'secret',
      });
    });

    it('returns null when the URL is invalid', () => {
      process.env.SONGBOOK_NAVIDROME_SONGS_URL = 'not-a-url';
      process.env.SONGBOOK_NAVIDROME_USERNAME = 'user';
      process.env.SONGBOOK_NAVIDROME_PASSWORD = 'secret';
      expect(getNavidromeConfig()).toBeNull();
    });

    it('returns null on empty strings', () => {
      process.env.SONGBOOK_NAVIDROME_SONGS_URL = '';
      process.env.SONGBOOK_NAVIDROME_USERNAME = '';
      process.env.SONGBOOK_NAVIDROME_PASSWORD = '';
      expect(getNavidromeConfig()).toBeNull();
    });
  });

  describe('getVoicesConfig', () => {
    it('returns null when no vars are set', () => {
      expect(getVoicesConfig()).toBeNull();
    });

    it('returns null when only some vars are set', () => {
      process.env.SONGBOOK_VOICES_NAVIDROME_SONGS_URL = 'https://voices.example.com';
      process.env.SONGBOOK_VOICES_NAVIDROME_USERNAME = 'user';
      expect(getVoicesConfig()).toBeNull();
    });

    it('returns the parsed config when all vars are valid', () => {
      process.env.SONGBOOK_VOICES_NAVIDROME_SONGS_URL = 'https://voices.example.com';
      process.env.SONGBOOK_VOICES_NAVIDROME_USERNAME = 'voices-user';
      process.env.SONGBOOK_VOICES_NAVIDROME_PASSWORD = 'voices-secret';

      expect(getVoicesConfig()).toEqual({
        songsUrl: 'https://voices.example.com',
        username: 'voices-user',
        password: 'voices-secret',
      });
    });

    it('returns null when the URL is invalid', () => {
      process.env.SONGBOOK_VOICES_NAVIDROME_SONGS_URL = '::bad::';
      process.env.SONGBOOK_VOICES_NAVIDROME_USERNAME = 'user';
      process.env.SONGBOOK_VOICES_NAVIDROME_PASSWORD = 'secret';
      expect(getVoicesConfig()).toBeNull();
    });

    it('is independent from the main navidrome config', () => {
      process.env.SONGBOOK_NAVIDROME_SONGS_URL = 'https://nav.example.com';
      process.env.SONGBOOK_NAVIDROME_USERNAME = 'user';
      process.env.SONGBOOK_NAVIDROME_PASSWORD = 'secret';

      expect(getNavidromeConfig()).not.toBeNull();
      expect(getVoicesConfig()).toBeNull();
    });
  });
});
