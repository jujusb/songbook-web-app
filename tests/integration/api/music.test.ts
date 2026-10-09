import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { GET } from '@/app/api/music/[...path]/route';

function call(segments: string[]) {
  return GET({} as any, { params: Promise.resolve({ path: segments }) } as any);
}

describe('API /api/music/[...path]', () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'songbook-music-'));
    for (const name of ['a.mp3', 'a.wav', 'a.ogg', 'a.mp4', 'a.m4a', 'a.flac', 'a.bin']) {
      await writeFile(path.join(root, name), Buffer.from('audio-bytes'));
    }
    await mkdir(path.join(root, 'broken.mp3'));
    vi.stubEnv('MUSIC_DIR', root);
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it('serves an mp3 with the correct content type', async () => {
    const res = await call(['a.mp3']);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toBe('audio-bytes');
  });

  it.each([
    ['a.wav', 'audio/wav'],
    ['a.ogg', 'audio/ogg'],
    ['a.mp4', 'audio/mp4'],
    ['a.m4a', 'audio/mp4'],
    ['a.flac', 'audio/flac'],
  ])('serves %s as %s', async (file, type) => {
    const res = await call([file]);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(type);
  });

  it('falls back to octet-stream for unknown extensions', async () => {
    const res = await call(['a.bin']);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
  });

  it('returns 403 for directory traversal', async () => {
    const res = await call(['..', '..', 'etc', 'passwd']);
    expect(res.status).toBe(403);
  });

  it('returns 404 when the file does not exist', async () => {
    const res = await call(['nope.mp3']);
    expect(res.status).toBe(404);
  });

  it('returns 500 when the file cannot be read', async () => {
    const res = await call(['broken.mp3']);
    expect(res.status).toBe(500);
  });
});
