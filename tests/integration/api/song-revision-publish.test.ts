import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';
import { POST } from '@/app/api/songs/[id]/revisions/[timestamp]/publish/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { createUser, createSession } from '@/lib/auth';
import { createSong, saveSongTranslation, getSongTranslation } from '@/lib/content';
import { findSongPath, listRevisions } from '@/lib/content';

function createMockRequest(method: string, url: string) {
  return {
    method,
    url,
    json: async () => ({}),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

function params(id: string, timestamp: string) {
  return { params: Promise.resolve({ id, timestamp }) };
}

describe('API /api/songs/[id]/revisions/[timestamp]/publish', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let adminToken: string;
  let publicToken: string;
  let timestamp: string;

  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);

    await createUser('admin', 'adminpass', 'admin');
    adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
    await createUser('public', 'publicpass', 'public');
    publicToken = await createSession({ id: 'public', username: 'public', role: 'public' });

    await createSong('rev-song', 'Rev Song', 'en');
    await tempDir.writeFile(
      'library/no-album/rev-song/en.cho',
      '---\nlanguage: en\ntitle: Original Title\ntranslator: null\nstatus: draft\npublished: false\nmodifiedBy: admin\nlastModified: !!str 2026-01-01T00:00:00.000Z\n---\n{title: Original}\nVerse 1\n'
    );
    await saveSongTranslation(
      'rev-song',
      'en',
      { language: 'en', title: 'Second Title', translator: null, modifiedBy: 'admin', status: 'draft', published: false },
      '{title: Original}\nVerse 1\nVerse 2'
    );
    const songPath = await findSongPath('rev-song');
    const revisions = await listRevisions(songPath!, 'en');
    timestamp = revisions[0].timestamp;
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

  it('returns 403 in read-only mode', async () => {
    vi.stubEnv('SONGBOOK_READONLY', '1');
    const response = await POST(
      createMockRequest('POST', 'http://localhost/api/x'),
      params('rev-song', timestamp)
    );
    expect(response.status).toBe(403);
  });

  it('returns 401 for users without edit permission', async () => {
    mockAuth(publicToken);
    const response = await POST(
      createMockRequest('POST', 'http://localhost/api/x'),
      params('rev-song', timestamp)
    );
    expect(response.status).toBe(401);
  });

  it('returns 404 for a missing song', async () => {
    mockAuth(adminToken);
    const response = await POST(
      createMockRequest('POST', 'http://localhost/api/x'),
      params('missing-song', timestamp)
    );
    expect(response.status).toBe(404);
  });

  it('publishes a revision', async () => {
    mockAuth(adminToken);
    const response = await POST(
      createMockRequest('POST', 'http://localhost/api/x?lang=en'),
      params('rev-song', timestamp)
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('Published');

    const { meta } = await getSongTranslation('rev-song', 'en');
    expect(meta.published).toBe(true);
    expect(meta.publishedRevision).toBe(timestamp);
  });

  it('returns 500 for an unreadable revision', async () => {
    mockAuth(adminToken);
    const response = await POST(
      createMockRequest('POST', 'http://localhost/api/x'),
      params('rev-song', 'not-a-real-timestamp')
    );
    expect(response.status).toBe(500);
  });
});
