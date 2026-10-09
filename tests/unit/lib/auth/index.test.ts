import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createUser, 
  verifyPassword, 
  createSession, 
  getSession, 
  getCurrentUser,
  getUser,
  getUserByUsername,
  saveUser,
  deleteUser,
  canEdit, 
  canAdmin,
  canEditSong,
  canEditAlbum,
  canEditLanguage,
  canEditSongs,
  canCreateSetlist,
  canManageSetlistShares,
  ensureDefaultAdmin,
  listUsers,
  findOrCreateOidcUser,
} from '@/lib/auth';
import { createTempContentDir } from '../../../utils/temp-content';

describe('auth/index.ts', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  
  beforeEach(async () => {
    try {
      tempDir = await createTempContentDir();
    } catch (e) {
      console.error('Failed to create temp dir:', e);
      throw e;
    }
  });
  
  afterEach(async () => {
    if (tempDir) {
      await tempDir.cleanup();
    }
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('creates user with hashed password', async () => {
      const user = await createUser('testuser', 'password123', 'reviewer', 'Test User');
      
      expect(user.id).toBe('testuser');
      expect(user.username).toBe('testuser');
      expect(user.role).toBe('reviewer');
      expect(user.displayName).toBe('Test User');
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe('password123');
      expect(user.authProvider).toBe('local');
    });

    it('creates admin user', async () => {
      const user = await createUser('admin', 'adminpass', 'admin');
      expect(user.role).toBe('admin');
    });

    it('creates setlist_creator user', async () => {
      const user = await createUser('creator', 'pass', 'setlist_creator');
      expect(user.role).toBe('setlist_creator');
    });

    it('normalizes username to lowercase with dashes', async () => {
      const user = await createUser('Test User', 'password', 'reviewer');
      expect(user.id).toBe('test-user');
    });
  });

  describe('verifyPassword', () => {
    beforeEach(async () => {
      await createUser('testuser', 'correct-password', 'reviewer');
    });

    it('returns true for correct password', async () => {
      const user = await getUser('testuser');
      const result = await verifyPassword(user!, 'correct-password');
      expect(result).toBe(true);
    });

    it('returns false for incorrect password', async () => {
      const user = await getUser('testuser');
      const result = await verifyPassword(user!, 'wrong-password');
      expect(result).toBe(false);
    });

    it('returns false for OIDC users (no passwordHash)', async () => {
      const user = await getUser('testuser');
      user!.authProvider = 'oidc';
      user!.passwordHash = undefined;
      await saveUser(user!);
      
      const result = await verifyPassword(user!, 'any-password');
      expect(result).toBe(false);
    });
  });

  describe('Session management', () => {
    it('creates and validates session', async () => {
      await createUser('session-user', 'password', 'reviewer');
      const token = await createSession({ id: 'session-user', username: 'session-user', role: 'reviewer' });
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('gets current user from session', async () => {
      await createUser('current-user', 'password', 'admin');
      const token = await createSession({ id: 'current-user', username: 'current-user', role: 'admin' });
      
      const { cookies } = await import('next/headers');
      vi.mocked(cookies).mockReturnValue({
        get: vi.fn((name) => name === 'songbook-session' ? { value: token } : undefined),
      } as any);
      
      const user = await getCurrentUser();
      expect(user).toBeDefined();
      expect(user?.id).toBe('current-user');
      expect(user?.role).toBe('admin');
    });

    it('returns null for invalid session', async () => {
      const { cookies } = await import('next/headers');
      vi.mocked(cookies).mockReturnValue({
        get: vi.fn(() => undefined),
      } as any);
      
      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('User lookup', () => {
    beforeEach(async () => {
      await createUser('lookup-user', 'password', 'reviewer', 'Lookup User');
    });

    it('gets user by id', async () => {
      const user = await getUser('lookup-user');
      expect(user).toBeDefined();
      expect(user?.username).toBe('lookup-user');
    });

    it('gets user by username', async () => {
      const user = await getUserByUsername('lookup-user');
      expect(user).toBeDefined();
      expect(user?.id).toBe('lookup-user');
    });

    it('returns null for non-existent user', async () => {
      const user = await getUser('non-existent');
      expect(user).toBeNull();
    });

    it('lists all users', async () => {
      await createUser('user2', 'pass', 'public');
      await createUser('user3', 'pass', 'admin');
      
      const users = await listUsers();
      expect(users.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Permission helpers', () => {
    it('canEdit returns true for reviewer and admin', () => {
      expect(canEdit('reviewer')).toBe(true);
      expect(canEdit('admin')).toBe(true);
      expect(canEdit('public')).toBe(false);
      expect(canEdit('setlist_creator')).toBe(false);
      expect(canEdit(null)).toBe(false);
    });

    it('canAdmin returns true only for admin', () => {
      expect(canAdmin('admin')).toBe(true);
      expect(canAdmin('reviewer')).toBe(false);
      expect(canAdmin('public')).toBe(false);
      expect(canAdmin('setlist_creator')).toBe(false);
      expect(canAdmin(null)).toBe(false);
    });

    it('canEditSong checks explicit permissions', () => {
      const reviewerWithPerms = {
        id: 'user1',
        username: 'user1',
        role: 'reviewer' as const,
        permissions: {
          editSong: [{ songId: 'song1', lang: 'en' }],
          editAlbum: [],
          editLanguage: [],
        },
      };
      
      expect(canEditSong(reviewerWithPerms, 'song1', 'en')).toBe(true);
      expect(canEditSong(reviewerWithPerms, 'song1', 'es')).toBe(false);
      expect(canEditSong(reviewerWithPerms, 'song2', 'en')).toBe(false);
    });

    it('canEditSong returns true for admin regardless of permissions', () => {
      const admin = { id: 'admin', username: 'admin', role: 'admin' as const };
      expect(canEditSong(admin, 'any-song', 'any-lang')).toBe(true);
    });

    it('canEditSong returns false for non-reviewer/admin', () => {
      const publicUser = { id: 'public', username: 'public', role: 'public' as const };
      expect(canEditSong(publicUser, 'song1', 'en')).toBe(false);
    });

    it('canEditAlbum checks album permissions', () => {
      const reviewerWithAlbumPerm = {
        id: 'user1',
        username: 'user1',
        role: 'reviewer' as const,
        permissions: {
          editSong: [],
          editAlbum: [{ albumId: 'album1', lang: 'en' }],
          editLanguage: [],
        },
      };
      
      expect(canEditAlbum(reviewerWithAlbumPerm, 'album1', 'en')).toBe(true);
      expect(canEditAlbum(reviewerWithAlbumPerm, 'album1', 'es')).toBe(false);
      expect(canEditAlbum(reviewerWithAlbumPerm, 'album2', 'en')).toBe(false);
    });

    it('canEditLanguage checks language permissions', () => {
      const reviewerWithLangPerm = {
        id: 'user1',
        username: 'user1',
        role: 'reviewer' as const,
        permissions: {
          editSong: [],
          editAlbum: [],
          editLanguage: ['es', 'fr'],
        },
      };
      
      expect(canEditLanguage(reviewerWithLangPerm, 'es')).toBe(true);
      expect(canEditLanguage(reviewerWithLangPerm, 'fr')).toBe(true);
      expect(canEditLanguage(reviewerWithLangPerm, 'de')).toBe(false);
    });

    it('canEditSongs returns true for users with any edit permission', () => {
      const userWithSongPerm = {
        id: 'user1',
        username: 'user1',
        role: 'reviewer' as const,
        permissions: {
          editSong: [{ songId: 'song1', lang: 'en' }],
          editAlbum: [],
          editLanguage: [],
        },
      };
      
      const userWithAlbumPerm = {
        id: 'user2',
        username: 'user2',
        role: 'reviewer' as const,
        permissions: {
          editSong: [],
          editAlbum: [{ albumId: 'album1', lang: 'en' }],
          editLanguage: [],
        },
      };
      
      const userWithLangPerm = {
        id: 'user3',
        username: 'user3',
        role: 'reviewer' as const,
        permissions: {
          editSong: [],
          editAlbum: [],
          editLanguage: ['en'],
        },
      };
      
      const userNoPerm = {
        id: 'user4',
        username: 'user4',
        role: 'reviewer' as const,
        permissions: {
          editSong: [],
          editAlbum: [],
          editLanguage: [],
        },
      };
      
      expect(canEditSongs(userWithSongPerm)).toBe(true);
      expect(canEditSongs(userWithAlbumPerm)).toBe(true);
      expect(canEditSongs(userWithLangPerm)).toBe(true);
      expect(canEditSongs(userNoPerm)).toBe(false);
    });

    it('canCreateSetlist returns true for setlist_creator, reviewer, admin', () => {
      expect(canCreateSetlist('setlist_creator')).toBe(true);
      expect(canCreateSetlist('reviewer')).toBe(true);
      expect(canCreateSetlist('admin')).toBe(true);
      expect(canCreateSetlist('public')).toBe(false);
    });

    it('canManageSetlistShares returns true for setlist_creator, reviewer, admin', () => {
      expect(canManageSetlistShares('setlist_creator')).toBe(true);
      expect(canManageSetlistShares('reviewer')).toBe(true);
      expect(canManageSetlistShares('admin')).toBe(true);
      expect(canManageSetlistShares('public')).toBe(false);
    });
  });

  describe('OIDC user handling', () => {
    it('creates new OIDC user', async () => {
      const user = await findOrCreateOidcUser('oidc-sub-123', {
        email: 'test@example.com',
        name: 'Test User',
        preferred_username: 'testuser',
      }, 'reviewer');
      
      expect(user.authProvider).toBe('oidc');
      expect(user.oidcSub).toBe('oidc-sub-123');
      expect(user.email).toBe('test@example.com');
      expect(user.displayName).toBe('Test User');
      expect(user.role).toBe('reviewer');
    });

    it('updates existing OIDC user', async () => {
      await findOrCreateOidcUser('oidc-sub-456', {
        email: 'old@example.com',
        name: 'Old Name',
      }, 'public');
      
      const updated = await findOrCreateOidcUser('oidc-sub-456', {
        email: 'new@example.com',
        name: 'New Name',
      }, 'reviewer');
      
      expect(updated.email).toBe('new@example.com');
      expect(updated.displayName).toBe('New Name');
      expect(updated.role).toBe('reviewer');
    });
  });

  describe('ensureDefaultAdmin', () => {
    it('creates admin user when none exist', async () => {
      await ensureDefaultAdmin();
      
      const users = await listUsers();
      const admin = users.find(u => u.username === 'admin');
      expect(admin).toBeDefined();
      expect(admin?.role).toBe('admin');
    });

    it('does not create duplicate admin', async () => {
      await createUser('existing-admin', 'pass', 'admin');
      await ensureDefaultAdmin();
      
      const users = await listUsers();
      const admins = users.filter(u => u.role === 'admin');
      expect(admins.length).toBe(1);
    });
  });

  describe('deleteUser', () => {
    it('deletes user by id', async () => {
      await createUser('to-delete', 'password', 'reviewer');
      await deleteUser('to-delete');
      
      const user = await getUser('to-delete');
      expect(user).toBeNull();
    });
  });
});