import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';
import { GET as albumsGET, POST as albumsPOST, PUT as albumsPUT, DELETE as albumsDELETE } from '@/app/api/albums/route';
import { createTempContentDir } from '../../utils/temp-content';
import { createUser, createSession } from '@/lib/auth';
import { createAlbum } from '@/lib/content';

function createMockRequest(method: string, body?: unknown, url = 'http://localhost/api/albums') {
  return {
    method,
    url,
    json: async () => body,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

describe('API /api/albums', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let adminToken: string;
  let reviewerToken: string;
  
  beforeEach(async () => {
    tempDir = await createTempContentDir();
    //mockContentDir(tempDir);
    
    await createUser('admin', 'adminpass', 'admin');
    adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
    
    await createUser('reviewer', 'reviewerpass', 'reviewer');
    reviewerToken = await createSession({ id: 'reviewer', username: 'reviewer', role: 'reviewer' });
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

  describe('GET /api/albums', () => {
    it('returns empty list when no albums exist', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('GET');
      const response = await albumsGET(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('returns all albums for admin', async () => {
      await createAlbum('album-1', 'Album One', 'various-artists');
      await createAlbum('album-2', 'Album Two', 'various-artists');
      
      mockAuth(adminToken);
      const req = createMockRequest('GET');
      const response = await albumsGET(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
    });

    it('returns published albums for public users', async () => {
      const { createSong, saveSongTranslation, getAlbum, saveAlbum } = await import('@/lib/content');
      await createAlbum('published-album', 'Published Album', 'various-artists');
      await createAlbum('draft-album', 'Draft Album', 'various-artists');

      // An album counts as published when it has at least one published song.
      await createSong('pub-song', 'Published Song', 'en', 'published-album');
      await saveSongTranslation(
        'pub-song',
        'en',
        { language: 'en', status: 'final', published: true },
        '{title: Published}',
        'published-album'
      );
      const pubAlbum = await getAlbum('published-album');
      pubAlbum.songs = ['pub-song'];
      await saveAlbum(pubAlbum);

      await createSong('draft-song', 'Draft Song', 'en', 'draft-album');
      await saveSongTranslation(
        'draft-song',
        'en',
        { language: 'en', status: 'draft', published: false },
        '{title: Draft}',
        'draft-album'
      );
      const draftAlbum = await getAlbum('draft-album');
      draftAlbum.songs = ['draft-song'];
      await saveAlbum(draftAlbum);

      mockAuth(undefined);
      const req = createMockRequest('GET');
      const response = await albumsGET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.map((a: any) => a.id)).toEqual(['published-album']);
    });

    it('returns 401 for non-admin requesting all=true', async () => {
      await createAlbum('hidden-album', 'Hidden Album', 'various-artists');

      mockAuth(reviewerToken);
      const req = createMockRequest('GET', undefined, 'http://localhost/api/albums?all=true');
      const response = await albumsGET(req);

      expect(response.status).toBe(401);
    });

    it('returns every album for admin with all=true', async () => {
      await createAlbum('album-a', 'Album A', 'various-artists');
      await createAlbum('album-b', 'Album B', 'various-artists');

      mockAuth(adminToken);
      const req = createMockRequest('GET', undefined, 'http://localhost/api/albums?all=true');
      const response = await albumsGET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
    });
  });

  describe('POST /api/albums', () => {
    it('creates new album with valid data', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        id: 'new-album',
        title: 'New Album',
        artist: 'various-artists',
        year: 2024,
        number: 1,
      });
      
      const response = await albumsPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.id).toBe('new-album');
    });

    it('returns 400 for missing required fields', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        title: 'No ID or Artist',
      });
      
      const response = await albumsPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(typeof data.error).toBe('string');
      expect(data.error.length).toBeGreaterThan(0);
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        id: 'test-album',
        title: 'Test Album',
        artist: 'various-artists',
      });
      
      const response = await albumsPOST(req);
      
      expect(response.status).toBe(403);
      vi.unstubAllEnvs();
    });

    it('returns 403 for non-admin users', async () => {
      mockAuth(reviewerToken);
      const req = createMockRequest('POST', {
        id: 'reviewer-album',
        title: 'Reviewer Album',
        artist: 'various-artists',
      });
      
      const response = await albumsPOST(req);
      expect(response.status).toBe(403);
    });

    it('returns 400 when the album fails validation', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        id: 'bad-album',
        title: 'Bad Album',
        artist: 'various-artists',
        spotify: 'https://not-spotify.example.com/album',
      });

      const response = await albumsPOST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(typeof data.error).toBe('string');
    });
  });

  describe('PUT /api/albums', () => {
    it('updates an existing album', async () => {
      await createAlbum('edit-album', 'Edit Album', 'various-artists');

      mockAuth(adminToken);
      const req = createMockRequest('PUT', {
        id: 'edit-album',
        title: 'Edited Album',
        artist: 'various-artists',
        songs: [],
      });

      const response = await albumsPUT(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true, id: 'edit-album' });
    });

    it('returns 400 when the album fails validation', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('PUT', { title: 'No ID', artist: 'various-artists' });

      const response = await albumsPUT(req);
      expect(response.status).toBe(400);
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');

      mockAuth(adminToken);
      const req = createMockRequest('PUT', {
        id: 'edit-album',
        title: 'Edited Album',
        artist: 'various-artists',
      });

      const response = await albumsPUT(req);
      expect(response.status).toBe(403);
      vi.unstubAllEnvs();
    });
  });

  describe('DELETE /api/albums', () => {
    it('deletes an album by id query param', async () => {
      await createAlbum('delete-me', 'Delete Me', 'various-artists');

      mockAuth(adminToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/albums?id=delete-me');
      const response = await albumsDELETE(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
    });

    it('returns 400 when id is missing', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('DELETE');
      const response = await albumsDELETE(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('id is required');
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');

      mockAuth(adminToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/albums?id=any');
      const response = await albumsDELETE(req);

      expect(response.status).toBe(403);
      vi.unstubAllEnvs();
    });
  });
});