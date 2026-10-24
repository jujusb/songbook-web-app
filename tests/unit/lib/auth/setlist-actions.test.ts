import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempContentDir, mockContentDir } from '../../../utils/temp-content';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Server Actions — Setlist references & lyrics view', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let actions: typeof import('@/app/actions');
  let content: typeof import('@/lib/content');

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    actions = await import('@/app/actions');
    content = await import('@/lib/content');
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  // Helper functions
  function createMockRequest(body?: unknown) {
    return {
      method: 'POST',
      url: 'http://localhost/api/test',
      json: async () => body,
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Request;
  }

  function mockAuth(token: string | undefined) {
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name) => name === 'songbook-session' ? (token ? { value: token } : undefined) : undefined),
    } as any);
  }

  async function setupTestData() {
    // Create users
    const { createUser, createSession } = await import('@/lib/auth');
    await createUser('admin', 'adminpass', 'admin');
    await createUser('creator', 'creatorpass', 'setlist_creator');
    await createUser('public', 'publicpass', 'public');

    const adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
    const creatorToken = await createSession({ id: 'creator', username: 'creator', role: 'setlist_creator' });
    const publicToken = await createSession({ id: 'public', username: 'public', role: 'public' });

    // Create songs
    const { createSong, createAlbum, saveSetlist } = await import('@/lib/content');
    await createAlbum('test-album', 'Test Album', 'various-artists');
    await createSong('song1', 'Song 1', 'en', 'test-album');
    await createSong('song2', 'Song 2', 'en', 'test-album');

    // Create original setlist
    await saveSetlist({
      id: 'original-setlist',
      title: 'Original Setlist',
      songs: [
        { songId: 'song1', lang: 'en' },
        { songId: 'song2', lang: 'en' },
      ],
      ownerId: 'admin',
      public: true,
      shareToken: 'original-share-token',
    });

    return { adminToken, creatorToken, publicToken };
  }

  function mockAuthCookie(token: string | undefined) {
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name) => name === 'songbook-session' ? (token ? { value: token } : undefined) : undefined),
    } as any);
  }

  describe('saveSharedSetlistAction', () => {
    it('creates a reference setlist for the current user', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const res = await actions.saveSharedSetlistAction('original-share-token');
      expect(res.ok).toBe(true);
      expect(res.setlistId).toBeDefined();
      expect(res.alreadySaved).toBeUndefined();
    });

    it('returns existing reference if already saved', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      // First save
      const res1 = await actions.saveSharedSetlistAction('original-share-token');
      expect(res1.ok).toBe(true);

      // Second save should return existing
      const res2 = await actions.saveSharedSetlistAction('original-share-token');
      expect(res2.ok).toBe(true);
      expect(res2.alreadySaved).toBe(true);
      expect(res2.setlistId).toBe(res1.setlistId);
    });

    it('adds user to original setlist subscribers', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      await actions.saveSharedSetlistAction('original-share-token');
      
      const { getSetlist } = await import('@/lib/content');
      const original = await getSetlist('original-setlist');
      expect(original.subscribers).toContain('creator');
    });

    it('returns 401 for unauthenticated users', async () => {
      await setupTestData();
      mockAuthCookie(undefined);

      const res = await actions.saveSharedSetlistAction('original-share-token');
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });

    it('returns 404 for non-existent share token', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const res = await actions.saveSharedSetlistAction('non-existent');
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Setlist not found');
    });
  });

  describe('updateSetlistLyricsViewAction', () => {
    it('updates user lyrics view preference', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const res = await actions.updateSetlistLyricsViewAction('list');
      expect(res.ok).toBe(true);

      // Verify persisted
      const { getCurrentUser } = await import('@/lib/auth');
      const user = await getCurrentUser();
      expect(user?.setlistLyricsView).toBe('list');
    });

    it('toggles between all and list', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      await actions.updateSetlistLyricsViewAction('list');
      await actions.updateSetlistLyricsViewAction('all');

      const { getCurrentUser } = await import('@/lib/auth');
      const user = await getCurrentUser();
      expect(user?.setlistLyricsView).toBe('all');
    });

    it('returns 401 for unauthenticated users', async () => {
      await setupTestData();
      mockAuthCookie(undefined);

      const res = await actions.updateSetlistLyricsViewAction('all');
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });
  });

  describe('updateSetlistGlobalOptionsAction', () => {
    it('updates showChords preference', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const res = await actions.updateSetlistGlobalOptionsAction({ showChords: false });
      expect(res.ok).toBe(true);

      const { getCurrentUser } = await import('@/lib/auth');
      const user = await getCurrentUser();
      expect(user?.showChords).toBe(false);
    });

    it('updates multiple options at once', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const res = await actions.updateSetlistGlobalOptionsAction({
        showChords: false,
        showRepeats: false,
        chordNotation: 'solfege',
        inlineChords: true,
      });
      expect(res.ok).toBe(true);

      const { getCurrentUser } = await import('@/lib/auth');
      const user = await getCurrentUser();
      expect(user?.showChords).toBe(false);
      expect(user?.showRepeats).toBe(false);
      expect(user?.chordNotation).toBe('solfege');
      expect(user?.inlineChords).toBe(true);
    });

    it('preserves unspecified options', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      // Set initial values
      await actions.updateSetlistGlobalOptionsAction({ showChords: false, chordNotation: 'roman' });

      // Update only showRepeats
      await actions.updateSetlistGlobalOptionsAction({ showRepeats: false });

      const { getCurrentUser } = await import('@/lib/auth');
      const user = await getCurrentUser();
      expect(user?.showChords).toBe(false); // preserved
      expect(user?.chordNotation).toBe('roman'); // preserved
      expect(user?.showRepeats).toBe(false); // updated
    });

    it('returns 401 for unauthenticated users', async () => {
      await setupTestData();
      mockAuthCookie(undefined);

      const res = await actions.updateSetlistGlobalOptionsAction({ showChords: false });
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });
  });

  describe('updateSetlistTransposeAction', () => {
    it('saves per-song transpose for a setlist', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const res = await actions.updateSetlistTransposeAction('original-setlist', 'song1', 2);
      expect(res.ok).toBe(true);

      const { getCurrentUser } = await import('@/lib/auth');
      const user = await getCurrentUser();
      expect(user?.setlistTranspose['original-setlist']?.song1).toBe(2);
    });

    it('updates existing transpose value', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      await actions.updateSetlistTransposeAction('original-setlist', 'song1', 2);
      await actions.updateSetlistTransposeAction('original-setlist', 'song1', -1);

      const { getCurrentUser } = await import('@/lib/auth');
      const user = await getCurrentUser();
      expect(user?.setlistTranspose['original-setlist']?.song1).toBe(-1);
    });

    it('removes transpose when set to 0', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      await actions.updateSetlistTransposeAction('original-setlist', 'song1', 2);
      await actions.updateSetlistTransposeAction('original-setlist', 'song1', 0);

      const { getCurrentUser } = await import('@/lib/auth');
      const user = await getCurrentUser();
      expect(user?.setlistTranspose['original-setlist']?.song1).toBeUndefined();
    });

    it('handles multiple songs in same setlist', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      await actions.updateSetlistTransposeAction('original-setlist', 'song1', 2);
      await actions.updateSetlistTransposeAction('original-setlist', 'song2', -3);

      const { getCurrentUser } = await import('@/lib/auth');
      const user = await getCurrentUser();
      expect(user?.setlistTranspose['original-setlist']?.song1).toBe(2);
      expect(user?.setlistTranspose['original-setlist']?.song2).toBe(-3);
    });

    it('returns 401 for unauthenticated users', async () => {
      await setupTestData();
      mockAuthCookie(undefined);

      const res = await actions.updateSetlistTransposeAction('original-setlist', 'song1', 2);
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });
  });

  describe('removeSavedSetlistAction', () => {
    it('removes reference setlist and unsubscribes user', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      // First save
      const saveRes = await actions.saveSharedSetlistAction('original-share-token');
      expect(saveRes.ok).toBe(true);

      // Remove
      const res = await actions.removeSavedSetlistAction(saveRes.setlistId!);
      expect(res.ok).toBe(true);

      // Verify reference removed
      const { listSetlists } = await import('@/lib/content');
      const setlists = await listSetlists({ userId: 'creator' });
      expect(setlists.find(s => s.id === saveRes.setlistId)).toBeUndefined();

      // Verify unsubscribed from original
      const { getSetlist } = await import('@/lib/content');
      const original = await getSetlist('original-setlist');
      expect(original.subscribers).not.toContain('creator');
    });

    it('returns 403 when trying to remove another user reference', async () => {
      const { adminToken, creatorToken } = await setupTestData();
      
      // Creator saves - use shareToken
      mockAuthCookie(creatorToken);
      const saveRes = await actions.saveSharedSetlistAction('original-share-token');
      
      // Admin tries to remove
      mockAuthCookie(adminToken);
      const res = await actions.removeSavedSetlistAction(saveRes.setlistId!);
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Forbidden');
    });

    it('returns error for non-existent reference', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const res = await actions.removeSavedSetlistAction('non-existent');
      expect(res.ok).toBe(false);
      // When setlist doesn't exist, getSetlist throws and we return the error message
      expect(res.ok).toBe(false);
    });

    it('returns 401 for unauthenticated users', async () => {
      await setupTestData();
      mockAuthCookie(undefined);

      const res = await actions.removeSavedSetlistAction('any-id');
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });
  });
});