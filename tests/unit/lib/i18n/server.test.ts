import { describe, it, expect, vi } from 'vitest';
import { createT, plural, getLocale } from '@/lib/i18n/server';

describe('i18n/server.ts', () => {
  describe('createT', () => {
    it('translates a key in the selected locale', () => {
      expect(createT('en')('nav.browse')).toBe('Browse');
      expect(createT('es')('nav.browse')).toBe('Explorar');
      expect(createT('fr')('nav.browse')).toBe('Parcourir');
    });

    it('falls back to English for an unknown locale', () => {
      expect(createT('de')('nav.browse')).toBe('Browse');
    });

    it('returns the key when missing from the locale and English', () => {
      expect(createT('en')('does.not.exist')).toBe('does.not.exist');
      expect(createT('de')('does.not.exist')).toBe('does.not.exist');
    });

    it('returns the key when the path resolves to a non-string', () => {
      // `nav` is an object, not a translatable string
      expect(createT('en')('nav')).toBe('nav');
    });

    it('interpolates params', () => {
      expect(createT('en')('common.originalKey', { key: 'G' })).toBe('Original key: G');
      expect(createT('en')('common.confirmDelete', { label: 'Song' })).toBe('Delete Song?');
    });

    it('leaves unknown placeholders untouched', () => {
      expect(createT('en')('common.originalKey', { other: 'x' })).toBe(
        'Original key: {key}',
      );
    });

    it('returns the template when no params are passed', () => {
      expect(createT('en')('common.originalKey')).toBe('Original key: {key}');
    });

    it('falls back to English when the selected locale lacks the key', async () => {
      vi.resetModules();
      vi.doMock('@/lib/i18n/locales/es', () => ({
        default: { nav: { browse: 'Solo esto' } },
      }));
      const fresh = await import('@/lib/i18n/server');
      const t = fresh.createT('es');
      expect(t('nav.browse')).toBe('Solo esto');
      expect(t('common.save')).toBe('Save');
      expect(t('common.save', {})).toBe('Save');
      expect(t('nope.nope')).toBe('nope.nope');
      vi.doUnmock('@/lib/i18n/locales/es');
      vi.resetModules();
    });
  });

  describe('plural', () => {
    it('picks the singular for n === 1', () => {
      expect(plural('{n} song | {n} songs', 1)).toBe('{n} song');
      expect(plural('one|many', 1)).toBe('one');
    });

    it('picks the plural otherwise', () => {
      expect(plural('{n} song | {n} songs', 0)).toBe('{n} songs');
      expect(plural('{n} song | {n} songs', 5)).toBe('{n} songs');
    });

    it('falls back gracefully on malformed templates', () => {
      expect(plural('always', 1)).toBe('always');
      expect(plural('always', 2)).toBe('always');
      expect(plural('|', 1)).toBe('|');
      expect(plural('one |', 2)).toBe('one');
    });
  });

  describe('getLocale', () => {
    const store = (value: string) => ({
      get: (name: string) => (name === 'songbook-ui-locale' ? { value } : undefined),
    });

    it('reads a valid locale from the cookie store', () => {
      expect(getLocale(store('es'))).toBe('es');
      expect(getLocale(store('en-US'))).toBe('en-US');
    });

    it('rejects invalid cookie values', () => {
      expect(getLocale(store('x'))).toBe('en');
      expect(getLocale(store('not a locale!'))).toBe('en');
    });

    it('returns the fallback when the cookie is absent', () => {
      expect(getLocale({ get: () => undefined })).toBe('en');
      expect(getLocale(store('es'), 'fr')).toBe('es');
    });

    it('returns the fallback when no store is provided', () => {
      expect(getLocale()).toBe('en');
      expect(getLocale(undefined, 'es')).toBe('es');
    });
  });
});
