import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { GET } from '@/app/api/partitions/[...path]/route';

function call(segments: string[]) {
  return GET({} as any, { params: Promise.resolve({ path: segments }) } as any);
}

describe('API /api/partitions/[...path]', () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'songbook-partitions-'));
    await writeFile(path.join(root, 'song.pdf'), Buffer.from('%PDF-1.4 test'));
    await writeFile(path.join(root, 'notes.txt'), 'hello');
    await mkdir(path.join(root, 'folder.pdf'));
    vi.stubEnv('PARTITIONS_DIR', root);
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it('serves an existing PDF', async () => {
    const res = await call(['song.pdf']);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe('inline');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toContain('%PDF-1.4 test');
  });

  it('serves a nested PDF by path segments', async () => {
    const res = await call(['song.pdf']);
    expect(res.status).toBe(200);
  });

  it('returns 403 for directory traversal', async () => {
    const res = await call(['..', '..', 'etc', 'passwd']);
    expect(res.status).toBe(403);
  });

  it('returns 404 when the file does not exist', async () => {
    const res = await call(['missing.pdf']);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-PDF extension', async () => {
    const res = await call(['notes.txt']);
    expect(res.status).toBe(400);
  });

  it('returns 500 when the file cannot be read', async () => {
    const res = await call(['folder.pdf']);
    expect(res.status).toBe(500);
  });
});
