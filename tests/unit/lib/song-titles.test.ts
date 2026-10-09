import { describe, it, expect } from 'vitest';
import { resolveSongListTitle } from '@/lib/song-titles';

describe('song-titles.ts', () => {
  describe('resolveSongListTitle', () => {
    it('prefers meta.yaml titles', () => {
      expect(
        resolveSongListTitle(
          { title: 'Default', titles: { es: 'Título' }, choTitles: { es: 'Cho Title' } },
          'es',
        ),
      ).toBe('Título');
    });

    it('falls back to the .cho title', () => {
      expect(
        resolveSongListTitle({ title: 'Default', choTitles: { fr: 'Titre' } }, 'fr'),
      ).toBe('Titre');
    });

    it('falls back to the default title', () => {
      expect(resolveSongListTitle({ title: 'Default' }, 'de')).toBe('Default');
      expect(resolveSongListTitle({ title: 'Default', titles: {} }, 'en')).toBe('Default');
    });

    it('ignores empty-string overrides', () => {
      expect(
        resolveSongListTitle({ title: 'Default', titles: { es: '' }, choTitles: { es: 'Cho' } }, 'es'),
      ).toBe('Cho');
    });
  });
});
