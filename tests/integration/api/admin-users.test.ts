import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';
import { GET, POST, PUT, DELETE } from '@/app/api/admin/users/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { createUser, createSession } from '@/lib/auth';

function createMockRequest(
  method: string,
  body?: unknown,
  url = 'http://localhost/api/admin/users'
) {
  return {
    method,
    url,
    json: async () => body,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

describe('API /api/admin/users', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let adminToken: string;
  let reviewerToken: string;

  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);

    await createUser('admin', 'adminpass', 'admin');
    adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });

    await createUser('reviewer', 'reviewerpass', 'reviewer');
    reviewerToken = await createSession({ id: 'reviewer', username: 'reviewer', role: 'reviewer' });
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function mockAuth(token: string | undefined) {
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name) =>
        name === 'songbook-session' ? (token ? { value: token } : undefined) : undefined
      ),
    } as any);
  }

  describe('GET /api/admin/users', () => {
    it('returns users without password hashes for admin', async () => {
      mockAuth(adminToken);
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.map((u: any) => u.username)).toContain('admin');
      data.forEach((u: any) => expect(u.passwordHash).toBeUndefined());
    });

    it('returns 401 without a session', async () => {
      mockAuth(undefined);
      const response = await GET();
      expect(response.status).toBe(401);
    });

    it('returns 401 for non-admin users', async () => {
      mockAuth(reviewerToken);
      const response = await GET();
      expect(response.status).toBe(401);
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      mockAuth(adminToken);
      const response = await GET();
      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/admin/users', () => {
    it('creates a user and strips the password hash', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        username: 'newuser',
        password: 'newpass123',
        displayName: 'New User',
        role: 'reviewer',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.username).toBe('newuser');
      expect(data.displayName).toBe('New User');
      expect(data.passwordHash).toBeUndefined();
    });

    it('defaults role to reviewer', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        username: 'defuser',
        password: 'newpass123',
      });

      const response = await POST(req);
      const data = await response.json();
      expect(response.status).toBe(201);
      expect(data.role).toBe('reviewer');
    });

    it('returns 400 when username or password missing', async () => {
      mockAuth(adminToken);
      const response = await POST(createMockRequest('POST', { username: 'nobody' }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Username and password required');
    });

    it('returns 400 for short username', async () => {
      mockAuth(adminToken);
      const response = await POST(
        createMockRequest('POST', { username: 'ab', password: 'newpass123' })
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('at least 3');
    });

    it('returns 400 for short password', async () => {
      mockAuth(adminToken);
      const response = await POST(
        createMockRequest('POST', { username: 'newuser', password: 'short' })
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('at least 8');
    });

    it('returns 409 for a duplicate username', async () => {
      mockAuth(adminToken);
      const response = await POST(
        createMockRequest('POST', { username: 'admin', password: 'newpass123' })
      );
      expect(response.status).toBe(409);
    });

    it('returns 401 without a session', async () => {
      mockAuth(undefined);
      const response = await POST(
        createMockRequest('POST', { username: 'newuser', password: 'newpass123' })
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      mockAuth(adminToken);
      const response = await POST(
        createMockRequest('POST', { username: 'newuser', password: 'newpass123' })
      );
      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/admin/users', () => {
    beforeEach(async () => {
      await createUser('target', 'targetpass123', 'reviewer', 'Target User');
    });

    it('updates role, display name, email and permissions', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('PUT', {
        userId: 'target',
        role: 'admin',
        displayName: 'Updated',
        email: 'target@example.com',
        permissions: { editSong: [], editAlbum: [], editLanguage: ['en'] },
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.role).toBe('admin');
      expect(data.displayName).toBe('Updated');
      expect(data.email).toBe('target@example.com');
      expect(data.permissions.editLanguage).toContain('en');
      expect(data.passwordHash).toBeUndefined();
    });

    it('returns 400 when userId is missing', async () => {
      mockAuth(adminToken);
      const response = await PUT(createMockRequest('PUT', { role: 'admin' }));
      expect(response.status).toBe(400);
    });

    it('returns 400 when trying to modify own account', async () => {
      mockAuth(adminToken);
      const response = await PUT(
        createMockRequest('PUT', { userId: 'admin', role: 'public' })
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('your own');
    });

    it('returns 404 when the user does not exist', async () => {
      mockAuth(adminToken);
      const response = await PUT(
        createMockRequest('PUT', { userId: 'ghost', role: 'admin' })
      );
      expect(response.status).toBe(404);
    });

    it('returns 400 for invalid permissions', async () => {
      mockAuth(adminToken);
      const response = await PUT(
        createMockRequest('PUT', {
          userId: 'target',
          permissions: { editSong: 'not-an-array' },
        })
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid permissions');
    });

    it('returns 401 without a session', async () => {
      mockAuth(undefined);
      const response = await PUT(
        createMockRequest('PUT', { userId: 'target', role: 'admin' })
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      mockAuth(adminToken);
      const response = await PUT(
        createMockRequest('PUT', { userId: 'target', role: 'admin' })
      );
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/admin/users', () => {
    it('deletes a user', async () => {
      await createUser('victim', 'victimpass123', 'public');
      mockAuth(adminToken);
      const response = await DELETE(
        createMockRequest('DELETE', undefined, 'http://localhost/api/admin/users?id=victim')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 when id is missing', async () => {
      mockAuth(adminToken);
      const response = await DELETE(createMockRequest('DELETE'));
      expect(response.status).toBe(400);
    });

    it('returns 400 when deleting yourself', async () => {
      mockAuth(adminToken);
      const response = await DELETE(
        createMockRequest('DELETE', undefined, 'http://localhost/api/admin/users?id=admin')
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('delete yourself');
    });

    it('returns 500 when the user does not exist', async () => {
      mockAuth(adminToken);
      const response = await DELETE(
        createMockRequest('DELETE', undefined, 'http://localhost/api/admin/users?id=ghost')
      );
      expect(response.status).toBe(500);
    });

    it('returns 401 without a session', async () => {
      mockAuth(undefined);
      const response = await DELETE(
        createMockRequest('DELETE', undefined, 'http://localhost/api/admin/users?id=admin')
      );
      expect(response.status).toBe(401);
    });
  });
});
