import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempContentDir, mockContentDir } from '../../../utils/temp-content';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('content/index.ts — Setlist references & canViewSetlist', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let content: typeof import('@/lib/content');
  let auth: typeof import('@/lib/auth');
  let actions: typeof import('@/app/actions');

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    content = await import('@/lib/content');
    auth = await import('@/lib/auth');
    actions = await import('@/app/actions');
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  function createMockRequest(body?: unknown) {
    return {
      method: 'POST',
      url: 'http://localhost/api/test',
      json: async () => body,
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Request;
  }

  function mockAuthCookie(token: string | undefined) {
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name) => name === 'songbook-session' ? (token ? { value: token } : undefined) : undefined),
    } as any);
  }

  async function setupTestData() {
    const { createUser, createSession } = await import('@/lib/auth');
    await createUser('admin', 'adminpass', 'admin');
    await createUser('creator', 'creatorpass', 'setlist_creator');
    await createUser('public', 'publicpass', 'public');

    const adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
    const creatorToken = await createSession({ id: 'creator', username: 'creator', role: 'setlist_creator' });
    const publicToken = await createSession({ id: 'public', username: 'public', role: 'public' });

    const { createSong, createAlbum, saveSetlist, saveSongTranslation } = await import('@/lib/content');
    await createAlbum('test-album', 'Test Album', 'various-artists');
    await createSong('song1', 'Song 1', 'en', 'test-album');
    await createSong('song2', 'Song 2', 'en', 'test-album');
    
    // Add translations for song1
    await saveSongTranslation('song1', 'en', { language: 'en', status: 'final', published: true, chordsPublished: false }, '{title: Song 1}\nVerse 1');
    await saveSongTranslation('song2', 'en', { language: 'en', status: 'final', published: true, chordsPublished: false }, '{title: Song 2}\nVerse 1');

    const { createUser: cu, createSession: cs } = await import('@/lib/auth');
    await cu('other', 'pass', 'setlist_creator');

    return { adminToken: await cs({ id: 'admin', username: 'admin', role: 'admin' }), creatorToken: await cs({ id: 'creator', username: 'creator', role: 'setlist_creator' }), publicToken: await cs({ id: 'public', username: 'public', role: 'public' }) };
  }

  describe('getSetlist — reference merge', () => {
    it('merges reference setlist with original data', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const { saveSetlist, getSetlist } = await import('@/lib/content');

      // Create original
      await saveSetlist({
        id: 'original',
        title: 'Original Title',
        description: 'Original Description',
        date: '2024-01-15',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'admin',
      });

      // Create reference
      await saveSetlist({
        id: 'saved-original-creator',
        title: 'Should be overwritten',
        description: 'Should be overwritten',
        date: '2024-01-01',
        songs: [], // empty for reference
        ownerId: 'creator',
        sharedFrom: { setlistId: 'original', shareToken: 'token', savedAt: '2024-01-01T00:00:00Z' },
        subscribers: [],
      });

      const merged = await getSetlist('saved-original-creator');

      // Should have original's mutable data
      expect(merged.title).toBe('Original Title');
      expect(merged.description).toBe('Original Description');
      expect(merged.date).toBe('2024-01-15');
      expect(merged.songs).toEqual([{ songId: 'song1', lang: 'en' }]);

      // Should keep reference metadata
      expect(merged.id).toBe('saved-original-creator');
      expect(merged.ownerId).toBe('creator');
      expect(merged.sharedFrom).toBeDefined();
      expect(merged.sharedFrom!.setlistId).toBe('original');
    });

    it('returns reference as-is when original not found', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const { saveSetlist, getSetlist } = await import('@/lib/content');

      await saveSetlist({
        id: 'broken-ref',
        title: 'Broken Ref',
        description: 'Desc',
        date: '2024-01-01',
        songs: [],
        ownerId: 'creator',
        sharedFrom: { setlistId: 'non-existent', shareToken: 'token', savedAt: '2024-01-01T00:00:00Z' },
        subscribers: [],
      });

      const merged = await getSetlist('broken-ref');
      expect(merged.title).toBe('Broken Ref'); // Keeps reference's own title
      expect(merged.songs).toEqual([]);
    });

    it('returns non-reference setlists unchanged', async () => {
      const { adminToken } = await setupTestData();
      mockAuthCookie(adminToken);

      const { saveSetlist, getSetlist } = await import('@/lib/content');

      await saveSetlist({
        id: 'regular',
        title: 'Regular',
        description: 'Desc',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'admin',
      });

      const setlist = await getSetlist('regular');
      expect(setlist.title).toBe('Regular');
      expect(setlist.sharedFrom).toBeUndefined();
    });
  });

  describe('listSetlists — reference filtering', () => {
    it('includes reference setlists for their owner', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const { saveSetlist, listSetlists } = await import('@/lib/content');

      // Create original (owned by admin)
      await saveSetlist({
        id: 'original',
        title: 'Original',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'admin',
        public: true,
      });

      // Creator saves it
      await saveSetlist({
        id: 'saved-original-creator',
        title: 'Original',
        songs: [],
        ownerId: 'creator',
        sharedFrom: { setlistId: 'original', shareToken: 'token', savedAt: '2024-01-01T00:00:00Z' },
        subscribers: [],
      });

      // Another creator saves it
      const { createUser, createSession } = await import('@/lib/auth');
      await createUser('creator2', 'pass', 'setlist_creator');
      await createUser('creator3', 'pass', 'setlist_creator');
      
      await saveSetlist({
        id: 'saved-original-creator2',
        title: 'Original',
        songs: [],
        ownerId: 'creator2',
        sharedFrom: { setlistId: 'original', shareToken: 'token', savedAt: '2024-01-01T00:00:00Z' },
        subscribers: [],
      });

      const all = await listSetlists({ userId: 'creator' });
      const creatorSetlists = all.filter(s => s.ownerId === 'creator');
      expect(creatorSetlists.map(s => s.id)).toContain('saved-original-creator');
      expect(creatorSetlists.map(s => s.id)).not.toContain('saved-original-creator2');
    });

    it('excludes reference setlists for non-owners', async () => {
      const { adminToken } = await setupTestData();
      mockAuthCookie(adminToken);

      const { saveSetlist, listSetlists } = await import('@/lib/content');

      // Create reference for creator
      await saveSetlist({
        id: 'saved-original-creator',
        title: 'Original',
        songs: [],
        ownerId: 'creator',
        sharedFrom: { setlistId: 'original', shareToken: 'token', savedAt: '2024-01-01T00:00:00Z' },
        subscribers: [],
      });

      const all = await listSetlists({ userId: 'admin' });
      expect(all.map(s => s.id)).not.toContain('saved-original-creator');
    });

    it('includes regular setlists for all users', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      const { saveSetlist, listSetlists } = await import('@/lib/content');

      await saveSetlist({
        id: 'regular',
        title: 'Regular Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'creator',
      });

      const all = await listSetlists({ userId: 'creator' });
      expect(all.map(s => s.id)).toContain('regular');
    });

    it('does not include references when no userId provided', async () => {
      const { adminToken } = await setupTestData();
      mockAuthCookie(adminToken);

      const { saveSetlist, listSetlists } = await import('@/lib/content');

      await saveSetlist({
        id: 'original',
        title: 'Original',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'admin',
        public: true,
      });

      await saveSetlist({
        id: 'saved-original-creator',
        title: 'Original',
        songs: [],
        ownerId: 'creator',
        sharedFrom: { setlistId: 'original', shareToken: 'token', savedAt: '2024-01-01T00:00:00Z' },
        subscribers: [],
      });

      const all = await listSetlists(); // no userId
      expect(all.map(s => s.id)).not.toContain('saved-original-creator');
      expect(all.map(s => s.id)).toContain('original');
    });
  });

  describe('canViewSetlist', () => {
    it('allows editors', async () => {
      const { adminToken } = await setupTestData();
      mockAuthCookie(adminToken);

      const { saveSetlist, getSetlist } = await import('@/lib/content');
      const { canViewSetlist, getSession, canEdit } = await import('@/lib/auth');

      await saveSetlist({
        id: 'private-setlist',
        title: 'Private',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'admin',
        public: false,
      });

      const setlist = await getSetlist('private-setlist');
      const session = await getSession();
      const isEditor = canEdit(session?.role ?? null);
      const canView = canViewSetlist(setlist, undefined, isEditor);
      
      expect(canView).toBe(true);
    });

    it('allows subscribers', async () => {
      const { creatorToken } = await setupTestData();
      mockAuthCookie(creatorToken);

      // Creator saves shared setlist - need original with shareToken
      await content.saveSetlist({
        id: 'original-with-token',
        title: 'Original With Token',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'admin',
        public: true,
        shareToken: 'original-share-token',
      });

      mockAuthCookie(creatorToken);
      await actions.saveSharedSetlistAction('original-share-token');

      const setlists = await content.listSetlists({ userId: 'creator' });
      const refSetlist = setlists.find(s => s.sharedFrom?.setlistId === 'original-with-token');
      
      // Get the original setlist to check subscribers
      const originalSetlist = await content.getSetlist('original-with-token');
      
      const session = await auth.getSession();
      const isEditor = auth.canEdit(session?.role ?? null);
      const isSubscriber = originalSetlist.subscribers?.includes('creator') ?? false;
      // Use the merged setlist for public/shareToken checks, but original for subscribers
      const mergedSetlist = await content.getSetlist(refSetlist!.id);
      const canView = auth.canViewSetlist(mergedSetlist, undefined, isEditor, isSubscriber);
      
      expect(canView).toBe(true);
    });

    it('allows public setlists for everyone', async () => {
      const { publicToken } = await setupTestData();
      mockAuthCookie(publicToken);

      const { saveSetlist, getSetlist } = await import('@/lib/content');
      const { canViewSetlist, getSession, canEdit } = await import('@/lib/auth');

      await saveSetlist({
        id: 'public-setlist',
        title: 'Public',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'admin',
        public: true,
      });

      const setlist = await getSetlist('public-setlist');
      const session = await getSession();
      const isEditor = canEdit(session?.role ?? null);
      const canView = canViewSetlist(setlist, undefined, isEditor);
      
      expect(canView).toBe(true);
    });

    it('allows share token access', async () => {
      const { adminToken } = await setupTestData();
      mockAuthCookie(adminToken);

      const { saveSetlist, getSetlist } = await import('@/lib/content');
      const { canViewSetlist, getSession, canEdit } = await import('@/lib/auth');

      await saveSetlist({
        id: 'shared-setlist',
        title: 'Shared',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'admin',
        public: false,
        shareToken: 'secret-token',
      });

      const setlist = await getSetlist('shared-setlist');
      const session = await getSession();
      const isEditor = canEdit(session?.role ?? null);
      const canView = canViewSetlist(setlist, 'secret-token', isEditor);
      
      expect(canView).toBe(true);
    });

    it('denies access to private setlists without token', async () => {
      const { publicToken } = await setupTestData();
      mockAuthCookie(publicToken);

      const { saveSetlist, getSetlist } = await import('@/lib/content');
      const { canViewSetlist, getSession, canEdit } = await import('@/lib/auth');

      await saveSetlist({
        id: 'private-setlist',
        title: 'Private',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'admin',
        public: false,
      });

      const setlist = await getSetlist('private-setlist');
      const session = await getSession();
      const isEditor = canEdit(session?.role ?? null);
      const canView = canViewSetlist(setlist, undefined, isEditor);
      
      expect(canView).toBe(false);
    });
  });
});