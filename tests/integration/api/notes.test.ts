import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';
import { GET as notesGET, POST as notesPOST } from '@/app/api/notes/route';
import { GET as noteGET, PUT as notePUT } from '@/app/api/notes/[noteId]/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { createUser, createSession } from '@/lib/auth';

function createMockRequest(method: string, body?: unknown) {
  return {
    method,
    url: 'http://localhost/api/notes',
    json: async () => body,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

describe('API /api/notes', () => {
  let tempDir: any;
  let adminToken: string;
  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    await createUser('admin', 'adminpass', 'admin');
    adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await tempDir.cleanup();
    vi.clearAllMocks();
  });
  function mockAuth(token: string | undefined) {
    vi.mocked(cookies).mockReturnValue({ get: vi.fn((name) => name === 'songbook-session' ? (token ? { value: token } : undefined) : undefined) } as any);
  }

  it('creates and fetches', async () => {
    mockAuth(adminToken);
    const note = { id: 'n1', title: 'My Note', sections: [{ type: 'api', name: 'a', api_url: 'https://example.com', resultSection: 'text', discriminator: 'none', fields: [{ name: 'text', style: 'plain' }] }] };
    const createRes = await notesPOST(createMockRequest('POST', note));
    console.log('create', createRes.status);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const fetchRes = await noteGET(createMockRequest('GET'), { params: Promise.resolve({ noteId: 'n1' }) } as any);
    console.log('fetch', fetchRes.status);
    const fetched = await fetchRes.json();
    console.log('sections', JSON.stringify(fetched.sections));
    expect(fetched.sections[0].api_url).toBe('https://example.com');
  });

  it('updates title and sections', async () => {
    mockAuth(adminToken);
    await notesPOST(createMockRequest('POST', { id: 'n2', title: 'T', sections: [] }));
    const updateRes = await notePUT({ method: 'PUT', url: 'http://localhost/api/notes/n2', json: async () => ({ id: 'n2', title: 'T2', sections: [{ type: 'api', name: 'a', api_url: 'https://example.com/x', resultSection: 'text' }] }), headers: new Headers({ 'content-type': 'application/json' }) } as any, { params: Promise.resolve({ noteId: 'n2' }) } as any);
    expect(updateRes.status).toBe(200);
    const fetched = await (await noteGET({} as any, { params: Promise.resolve({ noteId: 'n2' }) } as any)).json();
    console.log('fetched api_url', fetched.sections[0].api_url);
    expect(fetched.title).toBe('T2');
    expect(fetched.sections[0].api_url).toBe('https://example.com/x');
  });
});
