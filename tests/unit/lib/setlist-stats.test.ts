import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';

describe('setlist-stats', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let content: typeof import('@/lib/content');
  let stats: typeof import('@/lib/setlist-stats');

  const song = (songId: string) => ({ type: 'song' as const, songId, lang: 'en' });
  const now = new Date('2026-03-10T12:00:00Z');

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    content = await import('@/lib/content');
    stats = await import('@/lib/setlist-stats');

    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-03-01',
      songs: [song('song-a')],
      ownerId: 'creator',
    });
    await content.saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-03-08',
      songs: [song('song-a'), song('song-b')],
      ownerId: 'creator',
    });
    await content.saveSetlist({
      id: 'other',
      title: 'Other service',
      date: '2026-03-05',
      songs: [song('song-c')],
      ownerId: 'other',
    });
    await content.saveSetlist({
      id: 'old',
      title: 'Old service',
      date: '2025-12-01',
      songs: [song('song-old')],
      ownerId: 'other',
    });
    await content.saveSetlist({
      id: 'undated',
      title: 'Undated',
      songs: [song('song-undated')],
      ownerId: 'creator',
    });
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  function rowsBySong(result: { rows: Array<{ songId: string; count: number }> }) {
    return Object.fromEntries(result.rows.map((row) => [row.songId, row.count]));
  }

  it('counts each song once per dated event for admins', async () => {
    const result = await stats.collectSetlistUsage({ role: 'admin', period: 'month', now });

    expect(result.totalEvents).toBe(3);
    expect(result.undatedSetlists).toBe(1);
    expect(rowsBySong(result)).toEqual({ 'song-a': 2, 'song-b': 1, 'song-c': 1 });
  });

  it('limits setlist creators to their own setlists', async () => {
    const result = await stats.collectSetlistUsage({
      role: 'setlist_creator',
      userId: 'creator',
      period: 'month',
      now,
    });

    expect(result.totalEvents).toBe(2);
    expect(rowsBySong(result)).toEqual({ 'song-a': 2, 'song-b': 1 });
  });

  it('counts a saved shared setlist through its original only once', async () => {
    for (const id of ['saved-other-1', 'saved-other-2']) {
      await content.saveSetlist({
        id,
        title: 'Other service',
        songs: [],
        ownerId: 'creator',
        sharedFrom: {
          setlistId: 'other',
          shareToken: 'other-token',
          savedAt: '2026-03-06T00:00:00Z',
        },
      });
    }

    const result = await stats.collectSetlistUsage({
      role: 'setlist_creator',
      userId: 'creator',
      period: 'month',
      now,
    });

    expect(result.totalEvents).toBe(3);
    expect(rowsBySong(result)).toEqual({ 'song-a': 2, 'song-b': 1, 'song-c': 1 });
  });

  it('uses a rolling year window and excludes future dates', async () => {
    const result = await stats.collectSetlistUsage({ role: 'admin', period: 'year', now });

    expect(result.periodStart).toBe('2025-03-11');
    expect(result.totalEvents).toBe(4);
    expect(rowsBySong(result)).toEqual({
      'song-a': 2,
      'song-b': 1,
      'song-c': 1,
      'song-old': 1,
    });
  });

  it('keeps all dated events for the all-time period', async () => {
    const result = await stats.collectSetlistUsage({ role: 'admin', period: 'all', now });

    expect(result.periodStart).toBeNull();
    expect(result.totalEvents).toBe(4);
  });
});
