import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planSongbookChapters, loadPrintSongs } from '@/lib/print/load';
import type { ResolvedScopeSong } from '@/lib/export/song-scope';

const m = vi.hoisted(() => ({
  getSong: vi.fn(),
  getSongTranslations: vi.fn(),
  getSongTranslation: vi.fn(),
  getSongTitle: vi.fn(),
  extractBodyCapo: vi.fn(),
  renderToHtml: vi.fn(),
  renderReferencesHtml: vi.fn(),
}));

vi.mock('@/lib/content', () => ({
  getSong: m.getSong,
  getSongTranslations: m.getSongTranslations,
  getSongTranslation: m.getSongTranslation,
  getSongTitle: m.getSongTitle,
  extractBodyCapo: m.extractBodyCapo,
}));

vi.mock('@/lib/chordpro', () => ({
  renderToHtml: m.renderToHtml,
  renderReferencesHtml: m.renderReferencesHtml,
}));

function song(partial: Partial<ResolvedScopeSong>): ResolvedScopeSong {
  return { songId: 's1', ...partial };
}

describe('print/load.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.renderToHtml.mockReturnValue('<div>html</div>');
    m.renderReferencesHtml.mockReturnValue('<refs/>');
  });

  describe('planSongbookChapters', () => {
    it('plans a single explicit language', async () => {
      m.getSongTitle.mockResolvedValue('Song Title');

      const plan = await planSongbookChapters(
        [song({ lang: 'en', meta: { key: 'G', title: 'Fallback' } as never })],
        ['en', 'es'],
      );

      expect(plan).toEqual([
        { songId: 's1', title: 'Song Title', key: 'G', lang: 'en' },
      ]);
      expect(m.getSongTitle).toHaveBeenCalledWith('s1', 'en');
    });

    it('falls back to meta title then songId when title lookup fails', async () => {
      m.getSongTitle.mockRejectedValue(new Error('missing'));

      const withMeta = await planSongbookChapters(
        [song({ lang: 'en', meta: { title: 'Meta Title' } as never })],
        ['en'],
      );
      expect(withMeta[0].title).toBe('Meta Title');

      const withoutMeta = await planSongbookChapters([song({ lang: 'en' })], ['en']);
      expect(withoutMeta[0].title).toBe('s1');
    });

    it('expands a null language across requested languages that exist', async () => {
      m.getSongTranslations.mockResolvedValue(['en', 'fr']);
      m.getSongTitle.mockResolvedValue('Localized');

      const plan = await planSongbookChapters(
        [song({ lang: null, meta: { key: 'C' } as never })],
        ['en', 'es'],
      );

      expect(plan).toEqual([
        { songId: 's1', title: 'Localized', key: 'C', lang: 'en' },
      ]);
    });

    it('returns no chapters when translations cannot be read', async () => {
      m.getSongTranslations.mockRejectedValue(new Error('nope'));

      const plan = await planSongbookChapters([song({ lang: null })], ['en']);

      expect(plan).toEqual([]);
    });
  });

  describe('loadPrintSongs', () => {
    it('loads an explicit-language setlist item', async () => {
      m.getSongTranslation.mockResolvedValue({
        meta: { published: true },
        body: 'body',
        capo: 2,
      });

      const result = await loadPrintSongs(
        [song({ lang: 'en', meta: { title: 'Title', key: 'D' } as never })],
        ['en'],
        false,
      );

      expect(result).toEqual([
        {
          id: 's1',
          title: 'Title',
          key: 'D',
          capo: 2,
          lang: 'en',
          html: '<div>html</div>',
          refsHtml: '',
        },
      ]);
      expect(m.renderToHtml).toHaveBeenCalledWith('body', {
        inlineChords: false,
        repeatChorus: true,
      });
    });

    it('skips unpublished translations', async () => {
      m.getSongTranslation.mockResolvedValue({
        meta: { published: false },
        body: 'body',
        capo: null,
      });

      const result = await loadPrintSongs(
        [song({ lang: 'en', meta: { title: 'Title' } as never })],
        ['en'],
        false,
      );

      expect(result).toEqual([]);
    });

    it('skips unreadable translations', async () => {
      m.getSongTranslation.mockRejectedValue(new Error('broken'));

      const result = await loadPrintSongs(
        [song({ lang: 'en', meta: { title: 'Title' } as never })],
        ['en'],
        false,
      );

      expect(result).toEqual([]);
    });

    it('iterates languages for a null-language scope', async () => {
      m.getSongTranslations.mockResolvedValue(['en', 'es']);
      m.getSongTranslation.mockImplementation(async (_id: string, lang: string) => ({
        meta: { published: true },
        body: `body-${lang}`,
        capo: 0,
      }));

      const result = await loadPrintSongs(
        [song({ lang: null, meta: { title: 'T' } as never })],
        ['en', 'fr'],
        false,
      );

      expect(result.map((r) => r.lang)).toEqual(['en']);
      expect(result[0].html).toBe('<div>html</div>');
    });

    it('prefers per-language titles and choTitles', async () => {
      m.getSongTranslation.mockResolvedValue({
        meta: { published: true },
        body: 'b',
        capo: null,
      });

      const withTitles = await loadPrintSongs(
        [
          song({
            lang: 'en',
            meta: { titles: { en: 'Titles EN' }, title: 'Base' } as never,
          }),
        ],
        ['en'],
        false,
      );
      expect(withTitles[0].title).toBe('Titles EN');

      const withChoTitles = await loadPrintSongs(
        [
          song({
            lang: 'en',
            meta: { choTitles: { en: 'Cho EN' }, title: 'Base' } as never,
          }),
        ],
        ['en'],
        false,
      );
      expect(withChoTitles[0].title).toBe('Cho EN');

      const withBase = await loadPrintSongs(
        [song({ lang: 'en', meta: { title: 'Base' } as never })],
        ['en'],
        false,
      );
      expect(withBase[0].title).toBe('Base');

      const withId = await loadPrintSongs([song({ lang: 'en' })], ['en'], false);
      expect(withId[0].title).toBe('s1');
    });

    it('embeds references and falls back to the song key', async () => {
      m.getSong.mockResolvedValue({
        key: 'A',
        references: [{ type: 'bible', label: 'John', target: 'Jn' }],
      });
      m.getSongTranslation.mockResolvedValue({
        meta: { published: true },
        body: 'b',
        capo: null,
      });

      const result = await loadPrintSongs(
        [song({ lang: 'en', meta: { title: 'T' } as never })],
        ['en'],
        true,
      );

      expect(result[0].key).toBe('A');
      expect(result[0].refsHtml).toBe('<refs/>');
      expect(m.renderReferencesHtml).toHaveBeenCalled();
    });

    it('leaves refsHtml empty when there are no references', async () => {
      m.getSong.mockResolvedValue({ key: 'A', references: [] });
      m.getSongTranslation.mockResolvedValue({
        meta: { published: true },
        body: 'b',
        capo: null,
      });

      const result = await loadPrintSongs(
        [song({ lang: 'en', meta: { title: 'T', key: 'E' } as never })],
        ['en'],
        true,
      );

      expect(result[0].refsHtml).toBe('');
      expect(result[0].key).toBe('E');
    });
  });
});
