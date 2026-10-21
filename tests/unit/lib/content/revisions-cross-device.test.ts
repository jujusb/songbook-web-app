import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, readdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createTempContentDir, mockContentDir } from '../../../utils/temp-content';

/**
 * The content directory and the revision tree are usually two different bind
 * mounts, so `rename` between them fails with `EXDEV`. The move has to fall
 * back to a copy.
 */
const state = vi.hoisted(() => ({ failRename: false }));

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    rename: async (from: string, to: string) => {
      if (state.failRename) {
        throw Object.assign(
          new Error(`EXDEV: cross-device link not permitted, rename '${from}' -> '${to}'`),
          { code: 'EXDEV' }
        );
      }
      return actual.rename(from, to);
    },
  };
});

describe('content/revisions.ts across filesystems', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let revisions: typeof import('@/lib/content/revisions');
  let content: typeof import('@/lib/content');

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    revisions = await import('@/lib/content/revisions');
    content = await import('@/lib/content');
    state.failRename = true;
  });

  afterEach(async () => {
    state.failRename = false;
    if (tempDir) {
      await tempDir.cleanup();
    }
    vi.clearAllMocks();
  });

  const songDir = () => path.join(tempDir.contentPath, 'library', 'no-album', 'test-song');

  it('copies a legacy snapshot when the revision tree is on another filesystem', async () => {
    await content.createSong('test-song', 'Test', 'en');
    await writeFile(path.join(songDir(), 'en.cho'), '{title: Test}\n', 'utf-8');

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
    expect(
      existsSync(path.join(tempDir.revisionsPath, 'test-song', 'en', '2026-01-01T00-00-00-000Z.cho'))
    ).toBe(true);
    // The legacy folder is gone: the snapshot was moved, not copied twice.
    expect(existsSync(path.join(songDir(), '.revisions'))).toBe(false);
  });

  it('copies a snapshot when a song is renamed across filesystems', async () => {
    await content.createSong('test-song', 'Test', 'en');
    await writeFile(path.join(songDir(), 'en.cho'), '{title: Test}\n', 'utf-8');

    const revisionDir = path.join(tempDir.revisionsPath, 'test-song', 'en');
    await mkdir(revisionDir, { recursive: true });
    await writeFile(
      path.join(revisionDir, '2026-01-01T00-00-00-000Z.cho'),
      '{title: Old}\n',
      'utf-8'
    );

    await content.renameSong('test-song', 'renamed-song');

    expect(existsSync(path.join(tempDir.revisionsPath, 'test-song'))).toBe(false);
    const files = await readdir(path.join(tempDir.revisionsPath, 'renamed-song', 'en'));
    expect(files).toEqual(['2026-01-01T00-00-00-000Z.cho']);
  });
});
