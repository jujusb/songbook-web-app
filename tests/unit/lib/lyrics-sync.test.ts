import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import ChordSheetJS from 'chordsheetjs';
import { getSong } from '@/lib/content';
import { syncSongToMusicDir } from '@/lib/lyrics-sync';

vi.mock('@/lib/content', () => ({
  getSong: vi.fn(),
}));

const mockedGetSong = vi.mocked(getSong);
const BODY = [
  '{title: Amazing Grace}',
  '{start_of_verse}',
  'A[G]mazing [C]grace',
  '{end_of_verse}',
  '',
  '{start_of_verse}',
  'How [D]sweet the sound',
  '{end_of_verse}',
].join('\n');

describe('lyrics-sync.ts', () => {
  let dir: string;
  const originalEnv = process.env.MUSIC_DIR;

  beforeEach(async () => {
    vi.clearAllMocks();
    dir = await mkdtemp(path.join(os.tmpdir(), 'lyrics-sync-test-'));
    process.env.MUSIC_DIR = dir;
  });

  afterEach(async () => {
    if (originalEnv === undefined) delete process.env.MUSIC_DIR;
    else process.env.MUSIC_DIR = originalEnv;
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('does nothing when the music directory does not exist', async () => {
    process.env.MUSIC_DIR = path.join(dir, 'missing');
    await expect(syncSongToMusicDir('song', 'en', BODY)).resolves.toBeUndefined();
    expect(mockedGetSong).not.toHaveBeenCalled();
  });

  it('writes to the fallback <song>/<lang> directory and extracts lyrics', async () => {
    mockedGetSong.mockResolvedValue({ audioFiles: [] } as any);
    await syncSongToMusicDir('amazing-grace', 'en', BODY);

    const cho = await readFile(path.join(dir, 'amazing-grace', 'en', 'en.cho'), 'utf-8');
    const txt = await readFile(path.join(dir, 'amazing-grace', 'en', 'en.txt'), 'utf-8');
    expect(cho).toBe(BODY);
    expect(txt).toContain('Amazing grace');
    expect(txt).toContain('How sweet the sound');
    expect(txt).not.toContain('[G]');
    expect(txt).not.toContain('{start_of_verse}');
  });

  it('falls back when the song lookup throws', async () => {
    mockedGetSong.mockRejectedValue(new Error('not found'));
    await syncSongToMusicDir('ghost', 'es', BODY);
    const txt = await readFile(path.join(dir, 'ghost', 'es', 'es.txt'), 'utf-8');
    expect(txt).toContain('Amazing grace');
  });

  it('writes to directories derived from audio file paths', async () => {
    mockedGetSong.mockResolvedValue({
      audioFiles: [
        { lang: 'en', voice: 'a', path: '/api/music/voices/bar.mp3' },
        { lang: 'en', voice: 'b', path: '/music/other/qux.mp3' },
        { lang: 'es', voice: 'c', path: '/api/music/ignored/es.mp3' },
        { lang: 'en', voice: 'd', path: 'relative/path.mp3' },
      ],
    } as any);

    await syncSongToMusicDir('song', 'en', BODY);

    const first = await readFile(path.join(dir, 'voices', 'en.txt'), 'utf-8');
    const second = await readFile(path.join(dir, 'other', 'en.txt'), 'utf-8');
    expect(first).toContain('Amazing grace');
    expect(second).toContain('Amazing grace');
  });

  it('uses the fallback extractor after a ChordPro parse failure', async () => {
    const spy = vi
      .spyOn(ChordSheetJS.ChordProParser.prototype, 'parse')
      .mockImplementation(() => {
        throw new Error('parse boom');
      });
    mockedGetSong.mockResolvedValue({ audioFiles: [] } as any);

    const body = '[G]Amazing grace\n{start_of_verse}\nHow [C]sweet';
    await syncSongToMusicDir('fallback', 'en', body);

    const txt = await readFile(path.join(dir, 'fallback', 'en', 'en.txt'), 'utf-8');
    expect(txt).toContain('Amazing grace');
    expect(txt).toContain('How sweet');
    expect(txt).not.toContain('[G]');
    spy.mockRestore();
  });

  it('collapses multiple blank lines in extracted lyrics', async () => {
    mockedGetSong.mockResolvedValue({ audioFiles: [] } as any);
    const body = '{start_of_verse}\nLine\n{end_of_verse}\n\n\n\n{start_of_verse}\nLine 2\n{end_of_verse}';
    await syncSongToMusicDir('blank', 'en', body);
    const txt = await readFile(path.join(dir, 'blank', 'en', 'en.txt'), 'utf-8');
    expect(txt).toBe('Line\n\nLine 2');
  });
});
