import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, readdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createTempContentDir, mockContentDir } from '../../../utils/temp-content';

describe('content/revisions.ts', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let revisions: typeof import('@/lib/content/revisions');
  let content: typeof import('@/lib/content');

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    revisions = await import('@/lib/content/revisions');
    content = await import('@/lib/content');
  });

  afterEach(async () => {
    if (tempDir) {
      await tempDir.cleanup();
    }
    vi.clearAllMocks();
  });

  const songDir = () => path.join(tempDir.contentPath, 'library', 'no-album', 'test-song');
  const revisionDir = (lang = 'en') =>
    path.join(tempDir.revisionsPath, 'test-song', lang);

  async function writeTranslation(body = '{title: Test}\nVerse 1') {
    await content.createSong('test-song', 'Test', 'en');
    await writeFile(path.join(songDir(), 'en.cho'), body, 'utf-8');
  }

  describe('location', () => {
    it('saves snapshots outside the library, in content/revisions/<song-id>/<lang>', async () => {
      await writeTranslation();

      await content.saveSongTranslation(
        'test-song',
        'en',
        { language: 'en', status: 'draft', published: false },
        '{title: Test}\nVerse 1\nVerse 2'
      );

      const files = await readdir(revisionDir());
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.cho$/);

      // Nothing is left inside the song folder
      const songFiles = await readdir(songDir());
      expect(songFiles.some((f) => f === '.revisions')).toBe(false);
    });

    it('keeps the snapshots of a song when it moves to another album', async () => {
      await writeTranslation();
      await content.createAlbum('other-album', 'Other Album', 'various-artists');
      await content.saveSongTranslation(
        'test-song',
        'en',
        { language: 'en', status: 'draft', published: false },
        '{title: Test}\nVerse 2'
      );

      await content.changeSongAlbum('test-song', 'other-album');

      const files = await readdir(revisionDir());
      expect(files).toHaveLength(1);
    });

    it('moves the snapshots when the song is renamed', async () => {
      await writeTranslation();
      await content.saveSongTranslation(
        'test-song',
        'en',
        { language: 'en', status: 'draft', published: false },
        '{title: Test}\nVerse 2'
      );

      await content.renameSong('test-song', 'renamed-song');

      expect(existsSync(path.join(tempDir.revisionsPath, 'test-song'))).toBe(false);
      const files = await readdir(
        path.join(tempDir.revisionsPath, 'renamed-song', 'en')
      );
      expect(files).toHaveLength(1);
    });
  });

  describe('timestamps', () => {
    it('round-trips a timestamp through the file name', () => {
      const iso = '2026-10-21T18:34:32.794Z';
      const file = revisions.timestampToRevisionFile(iso);
      expect(file).toBe('2026-10-21T18-34-32-794Z.cho');
      expect(revisions.revisionFileToTimestamp(file)).toBe(iso);
    });

    it('rejects a timestamp that is not an ISO string', () => {
      expect(() => revisions.timestampToRevisionFile('not-a-timestamp')).toThrow();
      expect(() => revisions.timestampToRevisionFile('../../etc/passwd')).toThrow();
    });

    it('lists the snapshots with ISO timestamps, newest first', async () => {
      await writeTranslation();
      await content.saveSongTranslation(
        'test-song',
        'en',
        { language: 'en', status: 'draft', published: false },
        '{title: Test}\nVerse 2'
      );
      await content.saveSongTranslation(
        'test-song',
        'en',
        { language: 'en', status: 'draft', published: false },
        '{title: Test}\nVerse 3'
      );

      const list = await revisions.listRevisions('test-song', 'en');
      expect(list).toHaveLength(2);
      for (const entry of list) {
        expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(Number.isNaN(new Date(entry.timestamp).getTime())).toBe(false);
      }
      // Newest first
      expect(list[0].timestamp >= list[1].timestamp).toBe(true);
    });

    it('puts the newer of two snapshots of the same millisecond first', async () => {
      await writeTranslation();
      await mkdir(revisionDir(), { recursive: true });
      await writeFile(path.join(revisionDir(), '2026-01-01T00-00-00-000Z.cho'), 'first', 'utf-8');
      await writeFile(path.join(revisionDir(), '2026-01-01T00-00-00-000Z-1.cho'), 'second', 'utf-8');

      const list = await revisions.listRevisions('test-song', 'en');
      expect(list).toHaveLength(2);
      // The second snapshot of the same millisecond carries the `-1` suffix
      // and is the newer of the two.
      expect(list[0].file.endsWith('-1.cho')).toBe(true);
      expect(list[1].file.endsWith('Z.cho')).toBe(true);
    });
  });

  describe('safety', () => {
    it('refuses a language that tries to escape the revisions folder', async () => {
      await expect(revisions.listRevisions('test-song', '../../secrets')).rejects.toThrow();
    });

    it('refuses a file name that tries to escape the revisions folder', async () => {
      await writeTranslation();
      await content.saveSongTranslation(
        'test-song',
        'en',
        { language: 'en', status: 'draft', published: false },
        '{title: Test}\nVerse 2'
      );

      await expect(
        revisions.getRevision('test-song', 'en', '../../../library/no-album/test-song/en.cho')
      ).rejects.toThrow();
    });
  });

  describe('legacy layout', () => {
    it('migrates a .revisions folder inside the song folder on first read', async () => {
      await writeTranslation();
      const legacyDir = path.join(songDir(), '.revisions', 'en');
      await mkdir(legacyDir, { recursive: true });
      await writeFile(
        path.join(legacyDir, '2026-01-01T00-00-00-000Z.cho'),
        '{title: Legacy}\n',
        'utf-8'
      );

      const list = await revisions.listRevisions('test-song', 'en');

      expect(list).toHaveLength(1);
      expect(list[0].timestamp).toBe('2026-01-01T00:00:00.000Z');
      expect(existsSync(path.join(songDir(), '.revisions'))).toBe(false);
      expect(
        existsSync(path.join(revisionDir(), '2026-01-01T00-00-00-000Z.cho'))
      ).toBe(true);
    });
  });
});
