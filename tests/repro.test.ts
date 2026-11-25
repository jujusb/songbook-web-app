import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempContentDir, mockContentDir } from './utils/temp-content';
import { saveSetlist, getSetlist } from '@/lib/content';

describe('repro same date overwrite', () => {
  let tempDir: any;
  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
  });
  afterEach(async () => { await tempDir.cleanup(); });
  it('saves same date different content', async () => {
    await saveSetlist({ id: 'sunday', title: 'Sunday service', date: '2026-01-11', songs: [{ type: 'song', songId: 'b', lang: 'en' }], ownerId: 'creator' } as never);
    await saveSetlist({ id: 'sunday', title: 'Sunday service', date: '2026-01-11', songs: [{ type: 'song', songId: 'c', lang: 'en' }], ownerId: 'creator' } as never);
    const cur = await getSetlist('sunday');
    console.log('cur', cur.date, cur.songs);
  });
});
