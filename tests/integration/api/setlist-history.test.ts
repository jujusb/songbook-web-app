import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { GET as historyGET } from '@/app/setlists/[setlistId]/history/route';
import { POST as newDatePOST } from '@/app/setlists/[setlistId]/history/new-date/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { createUser, createSession } from '@/lib/auth';
import { getSetlist, listSetlistVersions, saveSetlist } from '@/lib/content';

describe('API /setlists/[setlistId]/history', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let adminToken: string;
  let creatorToken: string;
  let otherToken: string;
  let publicToken: string;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);

    await createUser('admin', 'adminpass', 'admin');
    adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
    await createUser('creator', 'creatorpass', 'setlist_creator');
    creatorToken = await createSession({ id: 'creator', username: 'creator', role: 'setlist_creator' });
    await createUser('other', 'otherpass', 'setlist_creator');
    otherToken = await createSession({ id: 'other', username: 'other', role: 'setlist_creator' });
    await createUser('public', 'publicpass', 'public');
    publicToken = await createSession({ id: 'public', username: 'public', role: 'public' });

    await saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-04',
      songs: [],
      ownerId: 'creator',
      shareToken: 'share-token',
    });
    await saveSetlist({
      id: 'sunday',
      title: 'Sunday service',
      date: '2026-01-11',
      songs: [],
      ownerId: 'creator',
      shareToken: 'share-token',
    });
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  function mockAuth(token: string | undefined) {
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name) => (name === 'songbook-session' && token ? { value: token } : undefined)),
    } as never);
  }

  function params(setlistId: string) {
    return { params: Promise.resolve({ setlistId }) };
  }

  it('lists versions for the owner', async () => {
    mockAuth(creatorToken);
    const response = await historyGET(
      new NextRequest('http://localhost/api/setlists/sunday/history'),
      params('sunday'),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: '2026-01-04', eventDate: '2026-01-04' })]),
    );
  });

  it('allows reading history through a share token', async () => {
    mockAuth(publicToken);
    const response = await historyGET(
      new NextRequest('http://localhost/api/setlists/sunday/history?share=share-token'),
      params('sunday'),
    );

    expect(response.status).toBe(200);
  });

  it('hides private history without a share token', async () => {
    mockAuth(publicToken);
    const response = await historyGET(
      new NextRequest('http://localhost/api/setlists/sunday/history'),
      params('sunday'),
    );

    expect(response.status).toBe(404);
  });

  it('lets an admin create a dated version', async () => {
    mockAuth(adminToken);
    const response = await newDatePOST(
      new NextRequest('http://localhost/api/setlists/sunday/history/new-date', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date: '2026-02-01', copy: true }),
      }),
      params('sunday'),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, date: '2026-02-01', label: '2026-02-01' });
  });

  it('rejects new-date by a public user', async () => {
    mockAuth(publicToken);
    const response = await newDatePOST(
      new NextRequest('http://localhost/api/setlists/sunday/history/new-date', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date: '2026-02-01' }),
      }),
      params('sunday'),
    );

    expect(response.status).toBe(401);
  });
});
