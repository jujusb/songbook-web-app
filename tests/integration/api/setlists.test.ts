import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';
import { GET as setlistsGET, POST as setlistsPOST, PUT as setlistsPUT, DELETE as setlistsDELETE } from '@/app/api/setlists/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { createUser, createSession } from '@/lib/auth';
import { createSong, createAlbum, saveSetlist } from '@/lib/content';

function createMockRequest(method: string, body?: unknown, url = 'http://localhost/api/setlists') {
  return {
    method,
    url,
    json: async () => body,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

describe('API /api/setlists', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let adminToken: string;
  let creatorToken: string;
  let publicToken: string;
  
  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    
    await createUser('admin', 'adminpass', 'admin');
    adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
    
    await createUser('creator', 'creatorpass', 'setlist_creator');
    creatorToken = await createSession({ id: 'creator', username: 'creator', role: 'setlist_creator' });
    
    await createUser('public', 'publicpass', 'public');
    publicToken = await createSession({ id: 'public', username: 'public', role: 'public' });
  });
  
  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  function mockAuth(token: string | undefined) {
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name) => name === 'songbook-session' ? (token ? { value: token } : undefined) : undefined),
    } as any);
  }

  describe('GET /api/setlists', () => {
    it('returns empty list when no setlists exist', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('GET');
      const response = await setlistsGET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('returns all setlists for admin', async () => {
      await createSong('song1', 'Song 1', 'en');
      await createSong('song2', 'Song 2', 'en');
      
      await saveSetlist({
        id: 'setlist-1',
        title: 'Setlist 1',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'admin',
      });
      
      await saveSetlist({
        id: 'setlist-2',
        title: 'Setlist 2',
        songs: [{ songId: 'song2', lang: 'en' }],
        ownerId: 'admin',
      });
      
      mockAuth(adminToken);
      const req = createMockRequest('GET');
      const response = await setlistsGET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
    });

    it('returns own setlists for setlist_creator', async () => {
      await createSong('song1', 'Song 1', 'en');
      
      await saveSetlist({
        id: 'creator-setlist',
        title: 'Creator Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'creator',
      });
      
      // Another creator's setlist (should not be visible)
      await saveSetlist({
        id: 'other-setlist',
        title: 'Other Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'other-user',
      });
      
      mockAuth(creatorToken);
      const req = createMockRequest('GET');
      const response = await setlistsGET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('creator-setlist');
    });

    it('returns public setlists for public users', async () => {
      await createSong('song1', 'Song 1', 'en');
      
      await saveSetlist({
        id: 'public-setlist',
        title: 'Public Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        public: true,
      });
      
      await saveSetlist({
        id: 'private-setlist',
        title: 'Private Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        public: false,
      });
      
      mockAuth(publicToken);
      const req = createMockRequest('GET');
      const response = await setlistsGET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('public-setlist');
    });

    it('returns a public user their own private setlist', async () => {
      await createSong('song1', 'Song 1', 'en');

      await saveSetlist({
        id: 'own-setlist',
        title: 'Own Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        public: false,
        ownerId: 'public',
      });

      await saveSetlist({
        id: 'someone-elses',
        title: 'Someone Elses',
        songs: [{ songId: 'song1', lang: 'en' }],
        public: false,
        ownerId: 'other-user',
      });

      mockAuth(publicToken);
      const req = createMockRequest('GET');
      const response = await setlistsGET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.map((s: any) => s.id)).toEqual(['own-setlist']);
    });

    it('returns public setlists when unauthenticated', async () => {
      await createSong('song1', 'Song 1', 'en');
      await saveSetlist({
        id: 'public-setlist',
        title: 'Public Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        public: true,
      });

      mockAuth(undefined);
      const req = createMockRequest('GET');
      const response = await setlistsGET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.map((s: any) => s.id)).toEqual(['public-setlist']);
    });
  });

  describe('POST /api/setlists', () => {
    beforeEach(async () => {
      await createAlbum('test-album', 'Test Album', 'various-artists');
      await createSong('song1', 'Song 1', 'en', 'test-album');
      await createSong('song2', 'Song 2', 'en', 'test-album');
    });

    it('creates setlist for setlist_creator', async () => {
      mockAuth(creatorToken);
      const req = createMockRequest('POST', {
        id: 'my-setlist',
        title: 'My Setlist',
        songs: [
          { songId: 'song1', lang: 'en' },
          { songId: 'song2', lang: 'en' },
        ],
      });
      
      const response = await setlistsPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.id).toBe('my-setlist');
    });

    it('creates setlist for admin', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        id: 'admin-setlist',
        title: 'Admin Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
      });
      
      const response = await setlistsPOST(req);
      expect(response.status).toBe(201);
    });

    it('returns 401 for public users', async () => {
      mockAuth(publicToken);
      const req = createMockRequest('POST', {
        id: 'public-setlist',
        title: 'Public Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
      });
      
      const response = await setlistsPOST(req);
      expect(response.status).toBe(401);
    });

    it('returns 400 for missing required fields', async () => {
      mockAuth(creatorToken);
      const req = createMockRequest('POST', {});
      
      const response = await setlistsPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('allows setlist creation in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      
      mockAuth(creatorToken);
      const req = createMockRequest('POST', {
        id: 'test-setlist',
        title: 'Test Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
      });
      
      const response = await setlistsPOST(req);
      expect(response.status).toBe(201);
      vi.unstubAllEnvs();
    });

    it('returns 500 when the request body cannot be parsed', async () => {
      mockAuth(creatorToken);
      const req = {
        json: async () => {
          throw new Error('bad json');
        },
      } as unknown as Request;

      const response = await setlistsPOST(req);
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/setlists', () => {
    beforeEach(async () => {
      await createAlbum('test-album', 'Test Album', 'various-artists');
      await createSong('song1', 'Song 1', 'en', 'test-album');
    });

    it('updates a setlist owned by the caller', async () => {
      await saveSetlist({
        id: 'creator-setlist',
        title: 'Creator Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'creator',
      });

      mockAuth(creatorToken);
      const req = createMockRequest('PUT', {
        id: 'creator-setlist',
        title: 'Updated Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
      });
      const response = await setlistsPUT(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('Updated Setlist');
      expect(data.ownerId).toBe('creator');
    });

    it('lets an admin update any setlist', async () => {
      await saveSetlist({
        id: 'other-setlist',
        title: 'Other Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'other-user',
      });

      mockAuth(adminToken);
      const req = createMockRequest('PUT', {
        id: 'other-setlist',
        title: 'Admin Edit',
        songs: [],
      });
      const response = await setlistsPUT(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ownerId).toBe('other-user');
    });

    it('returns 400 when id is missing', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('PUT', { title: 'No ID' });
      const response = await setlistsPUT(req);
      expect(response.status).toBe(400);
    });

    it('returns 404 when the setlist does not exist', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('PUT', { id: 'missing', title: 'Missing' });
      const response = await setlistsPUT(req);
      expect(response.status).toBe(404);
    });

    it('returns 403 for a non-owner setlist_creator', async () => {
      await saveSetlist({
        id: 'other-setlist',
        title: 'Other Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'other-user',
      });

      mockAuth(creatorToken);
      const req = createMockRequest('PUT', { id: 'other-setlist', title: 'Nope' });
      const response = await setlistsPUT(req);
      expect(response.status).toBe(403);
    });

    it('returns 401 for public users', async () => {
      mockAuth(publicToken);
      const req = createMockRequest('PUT', { id: 'anything', title: 'Nope' });
      const response = await setlistsPUT(req);
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/setlists', () => {
    beforeEach(async () => {
      await createAlbum('test-album', 'Test Album', 'various-artists');
      await createSong('song1', 'Song 1', 'en', 'test-album');
    });

    it('deletes a setlist owned by the caller', async () => {
      await saveSetlist({
        id: 'creator-setlist',
        title: 'Creator Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'creator',
      });

      mockAuth(creatorToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/setlists?id=creator-setlist');
      const response = await setlistsDELETE(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
    });

    it('lets an admin delete any setlist', async () => {
      await saveSetlist({
        id: 'other-setlist',
        title: 'Other Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'other-user',
      });

      mockAuth(adminToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/setlists?id=other-setlist');
      const response = await setlistsDELETE(req);
      expect(response.status).toBe(200);
    });

    it('returns 403 for a non-owner setlist_creator', async () => {
      await saveSetlist({
        id: 'other-setlist',
        title: 'Other Setlist',
        songs: [{ songId: 'song1', lang: 'en' }],
        ownerId: 'other-user',
      });

      mockAuth(creatorToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/setlists?id=other-setlist');
      const response = await setlistsDELETE(req);
      expect(response.status).toBe(403);
    });

    it('returns 400 when id is missing', async () => {
      mockAuth(creatorToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/setlists');
      const response = await setlistsDELETE(req);
      expect(response.status).toBe(400);
    });

    it('returns 401 for public users', async () => {
      mockAuth(publicToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/setlists?id=x');
      const response = await setlistsDELETE(req);
      expect(response.status).toBe(401);
    });

    it('returns 500 when the setlist does not exist', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/setlists?id=missing');
      const response = await setlistsDELETE(req);
      expect(response.status).toBe(500);
    });
  });
});