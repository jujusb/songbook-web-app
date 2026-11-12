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
    expect(versions).toHaveLength(2);
    expect(versions.find((v) => v.label === '2026-01-04')?.label).toBe('2026-01-04');
    expect(versions.find((v) => v.label === '2026-01-11')?.eventDate).toBe('2026-01-11');

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

    expect(await content.listSetlistVersions('sunday')).toHaveLength(1);
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

    expect(await content.listSetlistVersions('sunday')).toHaveLength(1);
  });

  it('rejects a duplicate setlist date', async () => {
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-11',
      songs: [song('song-a')],
      ownerId: 'creator',
    });

    const first = await content.createSetlistDateVersion('sunday', '2026-01-04', true);
    expect(first).toBe('2026-01-04');

    // Different content on the same date is not allowed, ensuring one
    // entry per link and day.
    await expect(content.createSetlistDateVersion('sunday', '2026-01-04', false)).rejects.toThrow();
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
    expect(await content.listSetlistVersions('sunday')).toHaveLength(2);
  });

  it('creates a dated version from explicit date, image and songs', async () => {
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-11',
      songs: [song('song-a')],
      ownerId: 'creator',
    });

    const label = await content.createSetlistDateVersion('sunday', '2026-02-01', true, {
      title: 'Easter service',
      description: 'Special event',
      image: 'https://example.com/easter.jpg',
      songs: [song('song-b')],
    });
    expect(label).toBe('2026-02-01');

    const version = await content.getSetlistVersion('sunday', label);
    expect(version.title).toBe('Easter service');
    expect(version.description).toBe('Special event');
    expect(version.image).toBe('https://example.com/easter.jpg');
    expect(version.songs).toEqual([song('song-b')]);

    // A newer date becomes the current setlist (content and date).
    const current = await content.getSetlist('sunday');
    expect(current.date).toBe('2026-02-01');
    expect(current.songs).toEqual([song('song-b')]);
  });

  it('keeps the current setlist when a dated version is older', async () => {
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-11',
      songs: [song('song-a')],
      ownerId: 'creator',
    });
    await content.createSetlistDateVersion('sunday', '2026-01-04', true);

    const current = await content.getSetlist('sunday');
    expect(current.date).toBe('2026-01-11');
    expect(current.songs).toEqual([song('song-a')]);
  });

  it('lists the content of dated versions for copying', async () => {
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-11',
      image: 'https://example.com/current.jpg',
      songs: [song('song-b')],
      ownerId: 'creator',
    });
    await content.createSetlistDateVersion('sunday', '2026-01-04', false, {
      title: 'Previous service',
      image: 'https://example.com/previous.jpg',
      songs: [song('song-a')],
    });

    const versions = await content.listSetlistVersionContents('sunday');
    expect(versions).toHaveLength(2);
    const previous = versions.find((version) => version.label === '2026-01-04');
    expect(previous).toMatchObject({
      label: '2026-01-04',
      title: 'Previous service',
      image: 'https://example.com/previous.jpg',
      eventDate: '2026-01-04',
    });
    expect(previous?.songs).toEqual([song('song-a')]);
  });

  it('includes the current setlist in the history timeline', async () => {
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-11',
      songs: [song('song-a')],
      ownerId: 'creator',
    });

    const versions = await content.listSetlistVersions('sunday');
    expect(versions.some((version) => version.eventDate === '2026-01-11')).toBe(true);
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

  it('prefers the version folder date over a stale date in the version file', async () => {
    const dir = `${tempDir.path}/data/setlists/legacy/2026-03-08`;
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(dir, { recursive: true });
    await writeFile(
      `${dir}/setlist.yaml`,
      `id: legacy\ntitle: Legacy\ndate: 2026-03-01\nsongs: []\n`,
      'utf-8',
    );

    const versions = await content.listSetlistVersions('legacy');
    expect(versions[0].eventDate).toBe('2026-03-08');

    const version = await content.getSetlistVersion('legacy', '2026-03-08');
    expect(version.date).toBe('2026-03-08');
  });

  it('uses the most recent dated folder as current, ignoring the root date', async () => {
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-11',
      songs: [song('song-a')],
      ownerId: 'creator',
    });
    // Point the root back to an older date; the newer folder must still win.
    const { readFile, writeFile } = await import('fs/promises');
    const rootPath = `${tempDir.path}/data/setlists/sunday.yaml`;
    const root = await readFile(rootPath, 'utf-8');
    await writeFile(rootPath, root.replace('2026-01-11', '2026-01-04'), 'utf-8');

    const current = await content.getSetlist('sunday');
    expect(current.date).toBe('2026-01-11');
    expect(current.songs).toEqual([song('song-a')]);
  });
});
