import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeSetlistMode } from '@/lib/setlist-modes';
import { getSetlistDefaultMode, getSetlistModesAllowed } from '@/lib/config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('normalizeSetlistMode', () => {
  it('maps the supported modes to themselves', () => {
    expect(normalizeSetlistMode('default')).toBe('default');
    expect(normalizeSetlistMode('public')).toBe('public');
    expect(normalizeSetlistMode('guitarist')).toBe('guitarist');
    expect(normalizeSetlistMode('rehersal')).toBe('rehersal');
  });

  it('maps legacy and alternate names to the new behaviours', () => {
    expect(normalizeSetlistMode('concert')).toBe('public');
    expect(normalizeSetlistMode('instrumentalist')).toBe('guitarist');
    expect(normalizeSetlistMode('rehearsal')).toBe('rehersal');
  });

  it('falls back to default for empty or unknown values', () => {
    expect(normalizeSetlistMode(undefined)).toBe('default');
    expect(normalizeSetlistMode('')).toBe('default');
    expect(normalizeSetlistMode('unknown')).toBe('default');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(normalizeSetlistMode('  PUBLIC ')).toBe('public');
  });
});

describe('setlist mode configuration', () => {
  it('defaults to the user-preference mode', () => {
    vi.stubEnv('SETLIST_DEFAULT_MODE', '');
    expect(getSetlistDefaultMode()).toBe('default');
  });

  it('normalizes the configured default mode', () => {
    vi.stubEnv('SETLIST_DEFAULT_MODE', 'concert');
    expect(getSetlistDefaultMode()).toBe('public');
  });

  it('offers the four canonical modes by default', () => {
    vi.stubEnv('SETLIST_MODES_ALLOWED', '');
    expect(getSetlistModesAllowed()).toEqual(['default', 'public', 'guitarist', 'rehersal']);
  });

  it('normalizes and dedupes configured allowed modes', () => {
    vi.stubEnv('SETLIST_MODES_ALLOWED', 'guitarist, concert, concert, rehersal');
    expect(getSetlistModesAllowed()).toEqual(['guitarist', 'public', 'rehersal']);
  });
});
