import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as registerPOST } from '@/app/api/auth/register/route';
import { POST as logoutPOST } from '@/app/api/auth/logout/route';
import { GET as meGET } from '@/app/api/auth/me/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { createUser, verifyPassword } from '@/lib/auth';

function createMockRequest(method: string, body?: unknown, url = 'http://localhost/api/auth/login') {
  return {
    method,
    url,
    json: async () => body,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

describe('API /api/auth', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  
  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
  });
  
  afterEach(async () => {
    await tempDir.cleanup();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await createUser('testuser', 'password123', 'reviewer', 'Test User');
    });

    it('returns success and session cookie on valid credentials', async () => {
      const req = createMockRequest('POST', {
        username: 'testuser',
        password: 'password123',
      }, 'http://localhost/api/auth/login');
      
      const response = await loginPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.role).toBe('reviewer');
      expect(response.headers.get('set-cookie')).toContain('songbook-session=');
    });

    it('returns 401 for invalid username', async () => {
      const req = createMockRequest('POST', {
        username: 'nonexistent',
        password: 'password123',
      }, 'http://localhost/api/auth/login');
      
      const response = await loginPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid credentials');
    });

    it('returns 401 for invalid password', async () => {
      const req = createMockRequest('POST', {
        username: 'testuser',
        password: 'wrongpassword',
      }, 'http://localhost/api/auth/login');
      
      const response = await loginPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid credentials');
    });

    it('returns 400 for missing credentials', async () => {
      const req = createMockRequest('POST', {
        username: 'testuser',
      }, 'http://localhost/api/auth/login');
      
      const response = await loginPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Username and password required');
    });

    it('allows login in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      
      const req = createMockRequest('POST', {
        username: 'testuser',
        password: 'password123',
      }, 'http://localhost/api/auth/login');
      
      const response = await loginPOST(req);
      
      expect(response.status).toBe(200);
      vi.unstubAllEnvs();
    });
  });

  describe('POST /api/auth/register', () => {
    it('creates new user and returns session', async () => {
      const req = createMockRequest('POST', {
        username: 'newuser',
        password: 'newpass123',
        displayName: 'New User',
      }, 'http://localhost/api/auth/register');
      
      const response = await registerPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.role).toBe('setlist_creator');
      expect(data.userId).toBeDefined();
      expect(response.headers.get('set-cookie')).toContain('songbook-session=');
    });

    it('returns 409 for existing username', async () => {
      await createUser('existing', 'pass', 'public');
      
      const req = createMockRequest('POST', {
        username: 'existing',
        password: 'newpass123',
      }, 'http://localhost/api/auth/register');
      
      const response = await registerPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(409);
      expect(data.error).toContain('already taken');
    });

    it('returns 400 for missing fields', async () => {
      const req = createMockRequest('POST', {
        username: 'newuser',
      }, 'http://localhost/api/auth/register');
      
      const response = await registerPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('allows registration in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      
      const req = createMockRequest('POST', {
        username: 'newuser',
        password: 'newpass123',
      }, 'http://localhost/api/auth/register');
      
      const response = await registerPOST(req);
      
      expect(response.status).toBe(200);
      vi.unstubAllEnvs();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session cookie', async () => {
      const req = createMockRequest('POST', {}, 'http://localhost/api/auth/logout');
      const response = await logoutPOST(req as any);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('set-cookie')).toContain('songbook-session=;');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user from session', async () => {
      await createUser('meuser', 'password', 'admin', 'Me User');
      const { createSession } = await import('@/lib/auth');
      const token = await createSession({ id: 'meuser', username: 'meuser', role: 'admin' });
      
      const { cookies } = await import('next/headers');
      vi.mocked(cookies).mockReturnValue({
        get: vi.fn((name) => name === 'songbook-session' ? { value: token } : undefined),
      } as any);
      
      const req = createMockRequest('GET', undefined, 'http://localhost/api/auth/me');
      const response = await meGET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe('meuser');
      expect(data.user.role).toBe('admin');
    });

    it('returns null when no session', async () => {
      const { cookies } = await import('next/headers');
      vi.mocked(cookies).mockReturnValue({
        get: vi.fn(() => undefined),
      } as any);
      
      const req = createMockRequest('GET', undefined, 'http://localhost/api/auth/me');
      const response = await meGET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user).toBeNull();
    });

    it('returns null for invalid session', async () => {
      const { cookies } = await import('next/headers');
      vi.mocked(cookies).mockReturnValue({
        get: vi.fn((name) => name === 'songbook-session' ? { value: 'invalid-token' } : undefined),
      } as any);
      
      const req = createMockRequest('GET', undefined, 'http://localhost/api/auth/me');
      const response = await meGET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user).toBeNull();
    });
  });
});