import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempContentDir, mockContentDir } from '../../../utils/temp-content';

describe('content/index.ts — setlist history', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let content: typeof import('@/lib/content');

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    content = await import('@/lib/content');
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  const song = (songId: string) => ({ type: 'song' as const, songId, lang: 'en' });

  it('archives the previous event when a recurrent setlist is reused', async () => {
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-04',
      songs: [song('song-a')],
      ownerId: 'creator',
    });
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-11',
      songs: [song('song-b')],
      ownerId: 'creator',
    });

    const versions = await content.listSetlistVersions('sunday');
    expect(versions).toHaveLength(1);
    expect(versions[0].label).toBe('2026-01-04');
    expect(versions[0].eventDate).toBe('2026-01-04');

    const archived = await content.getSetlistVersion('sunday', '2026-01-04');
    expect(archived.date).toBe('2026-01-04');
    expect(archived.songs).toEqual([song('song-a')]);

    const current = await content.getSetlist('sunday');
    expect(current.date).toBe('2026-01-11');
    expect(current.songs).toEqual([song('song-b')]);
  });

  it('does not create history for metadata-only changes', async () => {
    const base = {
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-04',
      songs: [song('song-a')],
      ownerId: 'creator',
    };
    await content.saveSetlist(base);
    await content.saveSetlist({ ...base, public: true, shareToken: 'share-token' });
    await content.saveSetlist({ ...base, subscribers: ['user-1'] });

    expect(await content.listSetlistVersions('sunday')).toHaveLength(0);
  });

  it('does not duplicate an identical snapshot', async () => {
    const base = {
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-04',
      songs: [song('song-a')],
      ownerId: 'creator',
    };
    await content.saveSetlist(base);
    await content.saveSetlist(base);

    expect(await content.listSetlistVersions('sunday')).toHaveLength(0);
  });

  it('avoids overwriting an existing date folder', async () => {
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-11',
      songs: [song('song-a')],
      ownerId: 'creator',
    });

    const first = await content.createSetlistDateVersion('sunday', '2026-01-04', true);
    expect(first).toBe('2026-01-04');

    const second = await content.createSetlistDateVersion('sunday', '2026-01-04', false);
    expect(second).toMatch(/^2026-01-04T/);

    const versions = await content.listSetlistVersions('sunday');
    expect(versions.map((version) => version.label).sort()).toEqual([first, second].sort());
    expect((await content.getSetlistVersion('sunday', second)).songs).toEqual([]);
  });

  it('creates a dated version without changing the current setlist', async () => {
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-11',
      songs: [song('song-a')],
      ownerId: 'creator',
    });

    const label = await content.createSetlistDateVersion('sunday', '2026-01-04', true);
    expect(label).toBe('2026-01-04');

    const version = await content.getSetlistVersion('sunday', label);
    expect(version.date).toBe('2026-01-04');
    expect(version.songs).toEqual([song('song-a')]);

    const current = await content.getSetlist('sunday');
    expect(current.date).toBe('2026-01-11');

    const again = await content.createSetlistDateVersion('sunday', '2026-01-04', true);
    expect(again).toBe(label);
    expect(await content.listSetlistVersions('sunday')).toHaveLength(1);
  });

  it('falls back to the version folder label for the event date', async () => {
    const dir = `${tempDir.path}/data/setlists/legacy/2026-02-01`;
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(dir, { recursive: true });
    await writeFile(
      `${dir}/setlist.yaml`,
      `id: legacy\ntitle: Legacy\nsongs: []\n`,
      'utf-8',
    );

    const versions = await content.listSetlistVersions('legacy');
    expect(versions[0]).toMatchObject({ label: '2026-02-01', eventDate: '2026-02-01' });
  });
});
