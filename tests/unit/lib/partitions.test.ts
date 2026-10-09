import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  getPartitionsDir,
  scanPartitionFiles,
  matchPartitions,
  partitionInstrumentOf,
  slugify,
  basenameWithoutExtension,
} from '@/lib/partitions';
import type { SongListItem } from '@/lib/content';

function song(partial: Partial<SongListItem> & { id: string; title: string }): SongListItem {
  return partial as SongListItem;
}

describe('partitions.ts', () => {
  let dir: string;
  const originalEnv = process.env.PARTITIONS_DIR;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'partitions-test-'));
    process.env.PARTITIONS_DIR = dir;
  });

  afterEach(async () => {
    if (originalEnv === undefined) delete process.env.PARTITIONS_DIR;
    else process.env.PARTITIONS_DIR = originalEnv;
    await rm(dir, { recursive: true, force: true });
  });

  describe('getPartitionsDir', () => {
    it('uses PARTITIONS_DIR when set', () => {
      expect(getPartitionsDir()).toBe(dir);
    });

    it('falls back to public/partitions', () => {
      delete process.env.PARTITIONS_DIR;
      expect(getPartitionsDir()).toBe(path.join(process.cwd(), 'public', 'partitions'));
    });
  });

  describe('re-exports', () => {
    it('exposes the partition-utils helpers', () => {
      expect(typeof partitionInstrumentOf).toBe('function');
      expect(slugify('Cuerdas')).toBe('cuerdas');
      expect(basenameWithoutExtension('a/b.pdf')).toBe('b');
    });
  });

  describe('scanPartitionFiles', () => {
    it('returns [] when the root does not exist', async () => {
      process.env.PARTITIONS_DIR = path.join(dir, 'missing');
      expect(await scanPartitionFiles()).toEqual([]);
    });

    it('returns [] when the root is not a directory', async () => {
      const filePath = path.join(dir, 'file-not-dir');
      await writeFile(filePath, 'x');
      process.env.PARTITIONS_DIR = filePath;
      expect(await scanPartitionFiles()).toEqual([]);
    });

    it('walks directories and collects PDFs recursively', async () => {
      await mkdir(path.join(dir, 'cuerdas', 'sub'), { recursive: true });
      await writeFile(path.join(dir, 'root.pdf'), 'x');
      await writeFile(path.join(dir, 'cuerdas', 'guitarra.pdf'), 'x');
      await writeFile(path.join(dir, 'cuerdas', 'sub', 'bajo.pdf'), 'x');
      await writeFile(path.join(dir, 'cuerdas', 'notes.txt'), 'x');

      const files = await scanPartitionFiles();
      expect(files).toHaveLength(3);
      // sorted by relative file path
      expect(files.map((f) => f.file)).toEqual([
        'cuerdas/guitarra.pdf',
        'cuerdas/sub/bajo.pdf',
        'root.pdf',
      ]);
      const rootFile = files.find((f) => f.file === 'root.pdf')!;
      expect(rootFile.instrument).toBe('otros');
      expect(rootFile.instrumentLabel).toBe('Otros');
      const guitar = files.find((f) => f.file === 'cuerdas/guitarra.pdf')!;
      expect(guitar.instrument).toBe('cuerdas');
      expect(guitar.instrumentLabel).toBe('cuerdas');
      expect(guitar.title).toBe('guitarra');
    });

    it('decodes percent-encoded filenames', async () => {
      await writeFile(path.join(dir, 'Canci%C3%B3n.pdf'), 'x');
      const files = await scanPartitionFiles();
      expect(files[0].title).toBe('Canción');
    });

    it('ignores non-pdf files at the root', async () => {
      await writeFile(path.join(dir, 'readme.md'), 'x');
      expect(await scanPartitionFiles()).toEqual([]);
    });
  });

  describe('matchPartitions', () => {
    it('returns [] when there are no files', async () => {
      expect(await matchPartitions([song({ id: 'a', title: 'A' })])).toEqual([]);
    });

    it('matches by title and includes instrument info', async () => {
      await mkdir(path.join(dir, 'cuerdas'), { recursive: true });
      await writeFile(path.join(dir, 'cuerdas', 'Amazing Grace.pdf'), 'x');

      const result = await matchPartitions([song({ id: 'amazing-grace', title: 'Amazing Grace' })]);
      expect(result).toHaveLength(1);
      expect(result[0].songId).toBe('amazing-grace');
      expect(result[0].partitions[0]).toMatchObject({
        instrument: 'cuerdas',
        file: 'cuerdas/Amazing Grace.pdf',
        title: 'Amazing Grace',
      });
    });

    it('matches by a localized title', async () => {
      await writeFile(path.join(dir, 'Gracia Asombrosa.pdf'), 'x');
      const result = await matchPartitions([
        song({ id: 's', title: 'Amazing Grace', titles: { es: 'Gracia Asombrosa' } }),
      ]);
      expect(result).toHaveLength(1);
    });

    it('requires whole-phrase word boundaries', async () => {
      await writeFile(path.join(dir, 'Disgrace.pdf'), 'x');
      const result = await matchPartitions([song({ id: 'g', title: 'Grace' })]);
      expect(result).toEqual([]);
    });

    it('skips songs with no matching partition', async () => {
      await writeFile(path.join(dir, 'Other.pdf'), 'x');
      const result = await matchPartitions([
        song({ id: 'a', title: 'Amazing Grace' }),
        song({ id: 'b', title: 'Other' }),
      ]);
      expect(result.map((r) => r.songId)).toEqual(['b']);
    });

    it('sorts matches by song title', async () => {
      await writeFile(path.join(dir, 'Alpha Song.pdf'), 'x');
      await writeFile(path.join(dir, 'Zeta Song.pdf'), 'x');
      const result = await matchPartitions([
        song({ id: 'z', title: 'Zeta Song' }),
        song({ id: 'a', title: 'Alpha Song' }),
      ]);
      expect(result.map((r) => r.title)).toEqual(['Alpha Song', 'Zeta Song']);
    });

    it('ignores empty candidate titles', async () => {
      await writeFile(path.join(dir, 'No Title.pdf'), 'x');
      const result = await matchPartitions([
        song({ id: 'empty', title: '', titles: { es: '' } }),
      ]);
      expect(result).toEqual([]);
    });
  });
});
