import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempContentDir } from '../../../utils/temp-content';

/**
 * The public instance is read-only. A draft translation is not served there —
 * the song page answers 404 for it — so the language lists must not announce
 * it either: a language that is present but not deployed stays invisible.
 */
describe('content/index.ts — drafts in read-only mode', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let content: typeof import('@/lib/content');

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    content = await import('@/lib/content');

    await content.createSong('test-song', 'Test Song', 'en');
    await content.saveSongTranslation(
      'test-song',
      'en',
      { language: 'en', status: 'final', published: true, chordsPublished: false },
      '{title: Test}\nEnglish'
    );
    await content.saveSongTranslation(
      'test-song',
      'es',
      { language: 'es', status: 'draft', published: false, chordsPublished: false },
      '{title: Prueba}\nEspanol'
    );
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (tempDir) {
      await tempDir.cleanup();
    }
  });

  it('lists only the published languages of a song', async () => {
    expect((await content.getSongTranslations('test-song')).sort()).toEqual(['en', 'es']);

    vi.stubEnv('SONGBOOK_READONLY', '1');

    expect(await content.getSongTranslations('test-song')).toEqual(['en']);
  });

  it('lists only the published languages in the song list', async () => {
    vi.stubEnv('SONGBOOK_READONLY', '1');

    const songs = await content.listSongs({ onlyPublished: true, role: 'public' });
    const song = songs.find((s) => s.id === 'test-song');

    expect(song?.translations).toEqual(['en']);
    // Nothing is left to mark as unpublished: the drafts are not mentioned.
    expect(song?.published).toEqual({ en: true });
    expect(song?.choTitles?.es).toBeUndefined();
  });

  it('keeps the drafts visible when the instance is writable', async () => {
    const songs = await content.listSongs({ onlyPublished: true, role: 'admin' });
    const song = songs.find((s) => s.id === 'test-song');

    expect(song?.translations?.sort()).toEqual(['en', 'es']);
    expect(song?.published).toEqual({ en: true, es: false });
  });

  it('does not list a song in a language that is not deployed', async () => {
    // Writable: the default language lists every song, even the ones that
    // only exist in another language.
    expect(content.shouldShowSongInLanguage(['fr'], 'en', 'en')).toBe(true);

    vi.stubEnv('SONGBOOK_READONLY', '1');

    // Read-only: the song is only listed in the language it is published in.
    expect(content.shouldShowSongInLanguage(['fr'], 'en', 'en')).toBe(false);
    expect(content.shouldShowSongInLanguage(['fr'], 'fr', 'en')).toBe(true);
  });
});
