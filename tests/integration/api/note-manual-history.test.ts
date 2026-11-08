import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { GET as manualGET, POST as manualPOST } from '@/app/api/notes/[noteId]/manual/route';
import {
  GET as versionGET,
  POST as versionPOST,
} from '@/app/api/notes/[noteId]/manual/[date]/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { createUser, createSession } from '@/lib/auth';
import { saveNote } from '@/lib/content/notes';

function createMockRequest(url: string, method: string, body?: unknown) {
  return {
    method,
    nextUrl: new URL(url),
    json: async () => body,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as NextRequest;
}

describe('API /api/notes/[noteId]/manual', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let adminToken: string;

  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    await createUser('admin', 'adminpass', 'admin');
    adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
    await saveNote({
      id: 'weekly-note',
      title: 'Weekly note',
      language: 'en-US',
      recurrent_type: 'weekly',
      recurrent_schedule: 'sunday',
      periodic_behavior: 'different_per_period',
      sections: [{ type: 'manual', md: 'Base text' }],
      tags: [],
    });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  function mockAuth(token: string | undefined) {
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name) =>
        name === 'songbook-session' ? (token ? { value: token } : undefined) : undefined,
      ),
    } as never);
  }

  it('requires edit permission', async () => {
    mockAuth(undefined);
    const res = await manualGET(
      createMockRequest('http://localhost/api/notes/weekly-note/manual?date=2026-01-04', 'GET'),
      { params: Promise.resolve({ noteId: 'weekly-note' }) },
    );
    expect(res.status).toBe(401);
  });

  it('saves, lists, and restores per-date content', async () => {
    mockAuth(adminToken);

    const saveRes = await manualPOST(
      createMockRequest('http://localhost/api/notes/weekly-note/manual', 'POST', {
        date: '2026-01-04',
        sections: { 'section-0': { md: 'First version' } },
      }),
      { params: Promise.resolve({ noteId: 'weekly-note' }) },
    );
    expect(saveRes.status).toBe(200);

    const updateRes = await manualPOST(
      createMockRequest('http://localhost/api/notes/weekly-note/manual', 'POST', {
        date: '2026-01-04',
        sections: { 'section-0': { md: 'Second version' } },
      }),
      { params: Promise.resolve({ noteId: 'weekly-note' }) },
    );
    expect(updateRes.status).toBe(200);

    const listRes = await versionGET(
      createMockRequest('http://localhost/api/notes/weekly-note/manual/2026-01-04', 'GET'),
      { params: Promise.resolve({ noteId: 'weekly-note', date: '2026-01-04' }) },
    );
    const listed = await listRes.json();
    expect(listed.versions).toHaveLength(1);

    const loadRes = await versionGET(
      createMockRequest(
        `http://localhost/api/notes/weekly-note/manual/2026-01-04?label=${encodeURIComponent(listed.versions[0].label)}`,
        'GET',
      ),
      { params: Promise.resolve({ noteId: 'weekly-note', date: '2026-01-04' }) },
    );
    expect((await loadRes.json()).content.sections['section-0'].md).toBe('First version');

    const restoreRes = await versionPOST(
      createMockRequest('http://localhost/api/notes/weekly-note/manual/2026-01-04', 'POST', {
        label: listed.versions[0].label,
      }),
      { params: Promise.resolve({ noteId: 'weekly-note', date: '2026-01-04' }) },
    );
    expect(restoreRes.status).toBe(200);

    const currentRes = await manualGET(
      createMockRequest('http://localhost/api/notes/weekly-note/manual?date=2026-01-04', 'GET'),
      { params: Promise.resolve({ noteId: 'weekly-note' }) },
    );
    expect((await currentRes.json()).content.sections['section-0'].md).toBe('First version');
  });

  it('rejects malformed save payloads', async () => {
    mockAuth(adminToken);
    const res = await manualPOST(
      createMockRequest('http://localhost/api/notes/weekly-note/manual', 'POST', {
        date: '2026-01-04',
      }),
      { params: Promise.resolve({ noteId: 'weekly-note' }) },
    );
    expect(res.status).toBe(400);
  });
});
