import { describe, it, expect } from 'vitest';
import { evaluateAccess, type GuardResult, type GuardSession } from '@/lib/auth/route-guard';
import type { Role } from '@/lib/auth/schemas';

function session(role: Role): GuardSession {
  return { userId: 'u1', role };
}

function decide(
  pathname: string,
  opts: { method?: string; role?: Role | null; params?: Record<string, string> } = {},
): GuardResult {
  const { method = 'GET', role = null, params = {} } = opts;
  const searchParams = new URLSearchParams(params);
  return evaluateAccess(
    { pathname, method, searchParams },
    role ? session(role) : null,
  );
}

const redirectsTo = (pathname: string, location: string, opts?: Parameters<typeof decide>[1]) =>
  expect(decide(pathname, opts)).toEqual({ type: 'redirect', location });

describe('evaluateAccess API routes', () => {
  it('requires admin for /api/admin/*', () => {
    expect(decide('/api/admin/users')).toEqual({ type: 'json', status: 401, error: 'Unauthorized' });
    expect(decide('/api/admin/users', { role: 'reviewer' })).toEqual({
      type: 'json',
      status: 401,
      error: 'Unauthorized',
    });
    expect(decide('/api/admin/users', { role: 'admin' })).toEqual({ type: 'next' });
  });

  it('requires the reviewer floor for song revisions', () => {
    expect(decide('/api/songs/abc/revisions')).toEqual({
      type: 'json',
      status: 401,
      error: 'Unauthorized',
    });
    expect(decide('/api/songs/abc/revisions/2024-01-01T00-00-00', { role: 'reviewer' })).toEqual({
      type: 'next',
    });
    expect(decide('/api/songs/abc/revisions/2024-01-01T00-00-00/publish', { method: 'POST', role: 'admin' })).toEqual({
      type: 'next',
    });
  });

  it('allows public reads of albums, artists and songs', () => {
    expect(decide('/api/albums')).toEqual({ type: 'next' });
    expect(decide('/api/artists')).toEqual({ type: 'next' });
    expect(decide('/api/songs')).toEqual({ type: 'next' });
    expect(decide('/api/songs', { role: 'setlist_creator' })).toEqual({ type: 'next' });
  });

  it('gates ?all=true reads to admins only', () => {
    expect(decide('/api/songs', { params: { all: 'true' } })).toEqual({
      type: 'json',
      status: 401,
      error: 'Unauthorized',
    });
    expect(decide('/api/albums', { params: { all: 'true' }, role: 'reviewer' })).toEqual({
      type: 'json',
      status: 401,
      error: 'Unauthorized',
    });
    expect(decide('/api/songs', { params: { all: 'true' }, role: 'admin' })).toEqual({ type: 'next' });
    expect(decide('/api/albums', { params: { all: 'true' }, role: 'admin' })).toEqual({ type: 'next' });
  });

  it('restricts album, artist and song writes to admins (closes former gaps)', () => {
    for (const pathname of ['/api/albums', '/api/artists', '/api/songs']) {
      expect(decide(pathname, { method: 'POST', role: 'reviewer' })).toEqual({
        type: 'json',
        status: 403,
        error: 'Forbidden',
      });
      expect(decide(pathname, { method: 'PUT', role: 'reviewer' })).toEqual({
        type: 'json',
        status: 403,
        error: 'Forbidden',
      });
      expect(decide(pathname, { method: 'DELETE' })).toEqual({
        type: 'json',
        status: 403,
        error: 'Forbidden',
      });
      expect(decide(pathname, { method: 'POST', role: 'admin' })).toEqual({ type: 'next' });
      expect(decide(pathname, { method: 'DELETE', role: 'admin' })).toEqual({ type: 'next' });
    }
  });

  it('allows public setlist reads but gates writes to setlist-capable roles', () => {
    expect(decide('/api/setlists')).toEqual({ type: 'next' });
    expect(decide('/api/setlists', { method: 'POST' })).toEqual({
      type: 'json',
      status: 401,
      error: 'Unauthorized',
    });
    expect(decide('/api/setlists', { method: 'POST', role: 'public' })).toEqual({
      type: 'json',
      status: 401,
      error: 'Unauthorized',
    });
    expect(decide('/api/setlists', { method: 'POST', role: 'setlist_creator' })).toEqual({ type: 'next' });
    expect(decide('/api/setlists', { method: 'PUT', role: 'reviewer' })).toEqual({ type: 'next' });
    expect(decide('/api/setlists', { method: 'DELETE', role: 'admin' })).toEqual({ type: 'next' });
  });

  it('leaves ungated API routes alone', () => {
    expect(decide('/api/pdf', { method: 'POST' })).toEqual({ type: 'next' });
    expect(decide('/api/auth/login', { method: 'POST' })).toEqual({ type: 'next' });
    expect(decide('/api/languages')).toEqual({ type: 'next' });
    expect(decide('/api/music/song.mp3')).toEqual({ type: 'next' });
  });
});

describe('evaluateAccess pages', () => {
  it('requires admin for /admin/*', () => {
    redirectsTo('/admin/users', '/login');
    redirectsTo('/admin/partitions', '/login', { role: 'reviewer' });
    expect(decide('/admin/users', { role: 'admin' })).toEqual({ type: 'next' });
  });

  it('requires the reviewer floor for authoring pages', () => {
    for (const pathname of ['/import', '/songs/new', '/artists/new', '/albums/new']) {
      redirectsTo(pathname, '/login');
      expect(decide(pathname, { role: 'reviewer' })).toEqual({ type: 'next' });
      expect(decide(pathname, { role: 'admin' })).toEqual({ type: 'next' });
    }
  });

  it('requires the reviewer floor for edit pages', () => {
    redirectsTo('/albums/classic-hymns/edit', '/login');
    redirectsTo('/edit/amazing-grace/en', '/login');
    expect(decide('/albums/classic-hymns/edit', { role: 'reviewer' })).toEqual({ type: 'next' });
    expect(decide('/edit/amazing-grace/en', { role: 'admin' })).toEqual({ type: 'next' });
  });

  it('requires a setlist-capable role for /setlists/new', () => {
    redirectsTo('/setlists/new', '/login');
    redirectsTo('/setlists/new', '/login', { role: 'public' });
    expect(decide('/setlists/new', { role: 'setlist_creator' })).toEqual({ type: 'next' });
    expect(decide('/setlists/new', { role: 'reviewer' })).toEqual({ type: 'next' });
  });

  it('requires any session for /profile', () => {
    redirectsTo('/profile', '/login');
    expect(decide('/profile', { role: 'public' })).toEqual({ type: 'next' });
  });

  it('redirects signed-in visitors away from /login and /register', () => {
    expect(decide('/login')).toEqual({ type: 'next' });
    expect(decide('/login', { role: 'reviewer' })).toEqual({ type: 'redirect', location: '/browse' });
    expect(decide('/register')).toEqual({ type: 'next' });
    expect(decide('/register', { role: 'setlist_creator' })).toEqual({
      type: 'redirect',
      location: '/setlists/new',
    });
  });

  it('leaves public pages untouched', () => {
    expect(decide('/')).toEqual({ type: 'next' });
    expect(decide('/browse')).toEqual({ type: 'next' });
    expect(decide('/songs/amazing-grace')).toEqual({ type: 'next' });
    expect(decide('/setlists/share/some-token')).toEqual({ type: 'next' });
  });
});
