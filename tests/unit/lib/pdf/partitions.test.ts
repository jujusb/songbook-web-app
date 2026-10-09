import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { loadPartitionPdf } from '@/lib/pdf/partitions';

describe('pdf/partitions.ts', () => {
  let dir: string;
  const originalEnv = process.env.PARTITIONS_DIR;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'pdf-partitions-test-'));
    process.env.PARTITIONS_DIR = dir;
  });

  afterEach(async () => {
    if (originalEnv === undefined) delete process.env.PARTITIONS_DIR;
    else process.env.PARTITIONS_DIR = originalEnv;
    await rm(dir, { recursive: true, force: true });
  });

  it('reads a PDF inside the partitions root', async () => {
    await writeFile(path.join(dir, 'song.pdf'), 'PDFDATA');
    const buffer = await loadPartitionPdf('song.pdf');
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(buffer!).toString()).toBe('PDFDATA');
  });

  it('reads nested PDFs', async () => {
    await mkdir(path.join(dir, 'sub'), { recursive: true });
    await writeFile(path.join(dir, 'sub', 'part.pdf'), 'NESTED');
    const buffer = await loadPartitionPdf('sub/part.pdf');
    expect(Buffer.from(buffer!).toString()).toBe('NESTED');
  });

  it('is case-insensitive about the extension', async () => {
    await writeFile(path.join(dir, 'UPPER.PDF'), 'DATA');
    expect(await loadPartitionPdf('UPPER.PDF')).not.toBeNull();
  });

  it('returns null for non-pdf extensions', async () => {
    await writeFile(path.join(dir, 'notes.txt'), 'DATA');
    expect(await loadPartitionPdf('notes.txt')).toBeNull();
  });

  it('returns null for missing files', async () => {
    expect(await loadPartitionPdf('missing.pdf')).toBeNull();
  });

  it('blocks directory traversal outside the root', async () => {
    expect(await loadPartitionPdf('../secret.pdf')).toBeNull();
    expect(await loadPartitionPdf('/tmp/evil.pdf')).toBeNull();
  });

  it('returns null for an empty path', async () => {
    expect(await loadPartitionPdf('')).toBeNull();
  });
});
