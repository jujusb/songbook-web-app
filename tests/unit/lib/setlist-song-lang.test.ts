import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import * as yaml from 'js-yaml';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { saveSetlist, getSetlist } from '@/lib/content';

describe('setlist song language round trip', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
  });
  afterEach(async () => {
    await tempDir.cleanup();
  });

  it('keeps a changed song language after saving', async () => {
    const base = {
      id: 'sun', title: 'Sunday', songs: [{ type: 'song' as const, songId: 'song-a', lang: 'en-US' }],
      voiceShares: [], public: false, subscribers: [], created: new Date().toISOString(),
    };
    await saveSetlist({ ...base, date: '2026-11-15' } as never);
    await saveSetlist({ ...base, date: '2026-11-15', songs: [{ type: 'song', songId: 'song-a', lang: 'fr-FR' }] } as never);
    const saved = await getSetlist('sun');
    expect(saved.songs[0]).toMatchObject({ songId: 'song-a', lang: 'fr-FR' });
  });
});

describe('current setlist save with a same-day timestamped version', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
  });
  afterEach(async () => {
    await tempDir.cleanup();
  });

  it('shows the song language that was just saved', async () => {
    const base = {
      id: 'sun2', title: 'Sunday', voiceShares: [], public: false, subscribers: [], created: new Date().toISOString(),
    };
    await saveSetlist({ ...base, date: '2026-11-15', songs: [{ type: 'song' as const, songId: 'song-a', lang: 'en-US' }] } as never);
    // A same-day timestamped version becomes the current one.
    const { getSetlistsDir } = await import('@/lib/content/paths');
    const folder = path.join(getSetlistsDir(), 'sun2', '2026-11-15-1700000000000');
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'setlist.yaml'), yaml.dump({
      id: 'sun2', title: 'Sunday', date: '2026-11-15', voiceShares: [], public: false, subscribers: [], created: new Date().toISOString(),
      songs: [{ type: 'song', songId: 'song-a', lang: 'en-US' }],
    }), 'utf-8');
    await saveSetlist({ ...base, date: '2026-11-15', songs: [{ type: 'song', songId: 'song-a', lang: 'fr-FR' }] } as never);
    const saved = await getSetlist('sun2');
    expect(saved.songs[0]).toMatchObject({ songId: 'song-a', lang: 'fr-FR' });
  });
});
