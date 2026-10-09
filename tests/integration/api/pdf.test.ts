import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';

const mocks = vi.hoisted(() => ({
  resolveScopeSongs: vi.fn(),
  loadPartitionPdf: vi.fn(),
  getLanguagesConfig: vi.fn(),
  getSetlist: vi.fn(),
}));

const puppeteerMocks = vi.hoisted(() => {
  const page = { setCookie: vi.fn(), goto: vi.fn(), pdf: vi.fn() };
  const browser = { newPage: vi.fn(), close: vi.fn() };
  return { page, browser };
});

vi.mock('puppeteer', () => ({
  default: { launch: vi.fn(async () => puppeteerMocks.browser) },
}));

vi.mock('@/lib/export/song-scope', () => ({
  resolveScopeSongs: mocks.resolveScopeSongs,
}));

vi.mock('@/lib/pdf/partitions', () => ({
  loadPartitionPdf: mocks.loadPartitionPdf,
}));

vi.mock('@/lib/content', () => ({
  getLanguagesConfig: mocks.getLanguagesConfig,
  getSetlist: mocks.getSetlist,
}));

import { POST, GET } from '@/app/api/pdf/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { createUser, createSession } from '@/lib/auth';

function createMockRequest(
  method: string,
  body?: unknown,
  url = 'http://localhost/api/pdf',
  cookie?: string
) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (cookie) headers.set('cookie', cookie);
  return {
    method,
    url,
    json: async () => {
      if (body === Symbol.for('invalid-json')) throw new Error('invalid');
      return body;
    },
    headers,
  } as unknown as Request;
}

describe('API /api/pdf', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let adminToken: string;
  let publicToken: string;

  const songWithParts = {
    scope: 'song',
    id: 'pdf-song',
    title: 'PDF Song',
    songs: [
      {
        songId: 'pdf-song',
        meta: { partitions: [] },
        lang: null,
      },
    ],
  };

  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);

    await createUser('admin', 'adminpass', 'admin');
    adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
    await createUser('public', 'publicpass', 'public');
    publicToken = await createSession({ id: 'public', username: 'public', role: 'public' });

    vi.mocked(cookies).mockReturnValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
      delete: vi.fn(),
    } as any);

    mocks.getLanguagesConfig.mockResolvedValue({
      languages: ['en', 'es', 'fr'],
      default: 'en',
    });
    mocks.getSetlist.mockResolvedValue({
      id: 's1',
      title: 'Setlist One',
      public: true,
      shareToken: 'share-1',
    });
    mocks.resolveScopeSongs.mockResolvedValue({
      scope: 'song',
      id: 'pdf-song',
      title: 'PDF Song',
      songs: [{ songId: 'pdf-song', meta: null, lang: null }],
    });
    mocks.loadPartitionPdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));

    puppeteerMocks.browser.newPage.mockResolvedValue(puppeteerMocks.page);
    puppeteerMocks.browser.close.mockResolvedValue(undefined);
    puppeteerMocks.page.setCookie.mockResolvedValue(undefined);
    puppeteerMocks.page.goto.mockResolvedValue(undefined);
    puppeteerMocks.page.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('POST /api/pdf', () => {
    it('returns 400 for an invalid JSON body', async () => {
      const req = createMockRequest('POST', Symbol.for('invalid-json'));
      const response = await POST(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid JSON');
    });

    it('returns 400 for an unknown type', async () => {
      const response = await POST(createMockRequest('POST', { type: 'weird' }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Unknown type');
    });

    it('generates a chords PDF for a song scope', async () => {
      const response = await POST(
        createMockRequest('POST', { type: 'chords', scope: 'song', id: 'pdf-song' })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(response.headers.get('content-disposition')).toContain('attachment');
      expect(puppeteerMocks.page.goto).toHaveBeenCalledWith(
        expect.stringContaining('/print/en?song=pdf-song'),
        expect.anything()
      );
    });

    it('builds an album scope URL', async () => {
      await POST(createMockRequest('POST', { type: 'chords', scope: 'album', id: 'alb-1' }));
      expect(puppeteerMocks.page.goto).toHaveBeenCalledWith(
        expect.stringContaining('/print/en?album=alb-1'),
        expect.anything()
      );
    });

    it('builds an artist scope URL', async () => {
      await POST(createMockRequest('POST', { type: 'chords', scope: 'artist', id: 'art-1' }));
      expect(puppeteerMocks.page.goto).toHaveBeenCalledWith(
        expect.stringContaining('/print/en?artist=art-1'),
        expect.anything()
      );
    });

    it('builds a book scope URL', async () => {
      await POST(createMockRequest('POST', { type: 'chords', scope: 'book', id: 'book-1' }));
      expect(puppeteerMocks.page.goto).toHaveBeenCalledWith(
        expect.stringContaining('/print/en?book=book-1'),
        expect.anything()
      );
    });

    it('builds a print/all URL for multiple languages with refs', async () => {
      await POST(
        createMockRequest('POST', {
          type: 'chords',
          scope: 'song',
          id: 'pdf-song',
          langs: ['es'],
          refs: true,
        })
      );
      const url = puppeteerMocks.page.goto.mock.calls[0][0] as string;
      expect(url).toContain('/print/all');
      expect(url).toContain('langs=en%2Ces');
      expect(url).toContain('refs=1');
    });

    it('uses a single non-default language when specified', async () => {
      await POST(
        createMockRequest('POST', {
          type: 'chords',
          scope: 'song',
          id: 'pdf-song',
          lang: 'es',
        })
      );
      expect(puppeteerMocks.page.goto).toHaveBeenCalledWith(
        expect.stringContaining('/print/es?'),
        expect.anything()
      );
    });

    it('builds a setlist print URL with the share token', async () => {
      const response = await POST(
        createMockRequest('POST', {
          type: 'chords',
          scope: 'setlist',
          id: 's1',
          share: 'share-1',
        })
      );
      expect(response.status).toBe(200);
      const url = puppeteerMocks.page.goto.mock.calls[0][0] as string;
      expect(url).toContain('/setlists/s1/print');
      expect(url).toContain('share=share-1');
    });

    it('returns 404 when the setlist cannot be found', async () => {
      mocks.getSetlist.mockRejectedValue(new Error('missing'));
      const response = await POST(
        createMockRequest('POST', { type: 'chords', scope: 'setlist', id: 'nope' })
      );
      expect(response.status).toBe(404);
    });

    it('returns 404 when the setlist is not viewable', async () => {
      mocks.getSetlist.mockResolvedValue({ id: 's2', title: 'Private', public: false });
      const response = await POST(
        createMockRequest('POST', { type: 'chords', scope: 'setlist', id: 's2' })
      );
      expect(response.status).toBe(404);
    });

    it('returns 400 when the scope has no songs', async () => {
      mocks.resolveScopeSongs.mockResolvedValue({
        scope: 'song',
        id: 'pdf-song',
        title: 'PDF Song',
        songs: [],
      });
      const response = await POST(
        createMockRequest('POST', { type: 'chords', scope: 'song', id: 'pdf-song' })
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No songs');
    });

    it('forwards the session cookie to the print page', async () => {
      await POST(
        createMockRequest(
          'POST',
          { type: 'chords', scope: 'song', id: 'pdf-song' },
          'http://localhost/api/pdf',
          'songbook-session=session-abc'
        )
      );
      expect(puppeteerMocks.page.setCookie).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'songbook-session', value: 'session-abc' })
      );
    });

    it('returns 500 when PDF generation fails', async () => {
      puppeteerMocks.page.pdf.mockRejectedValueOnce(new Error('render failed'));
      const response = await POST(
        createMockRequest('POST', { type: 'chords', scope: 'song', id: 'pdf-song' })
      );
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('render failed');
    });

    it('generates an instrumental PDF', async () => {
      mocks.resolveScopeSongs.mockResolvedValue({
        ...songWithParts,
        songs: [
          {
            songId: 'pdf-song',
            meta: {
              partitions: [
                { instrument: 'guitar', instrumentLabel: 'Guitarra', file: 'guitar.pdf', title: 'G' },
              ],
            },
            lang: null,
          },
        ],
      });

      const response = await POST(
        createMockRequest('POST', { type: 'instrumental', scope: 'song', id: 'pdf-song' })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(response.headers.get('content-disposition')).toContain('Guitarra');
      expect(mocks.loadPartitionPdf).toHaveBeenCalledWith('guitar.pdf');
    });

    it('filters instrumental partitions by instrument', async () => {
      mocks.resolveScopeSongs.mockResolvedValue({
        ...songWithParts,
        songs: [
          {
            songId: 'pdf-song',
            meta: {
              partitions: [
                { instrument: 'guitar', file: 'guitar.pdf', title: 'G' },
                { instrument: 'piano', file: 'piano.pdf', title: 'P' },
              ],
            },
            lang: null,
          },
        ],
      });

      await POST(
        createMockRequest('POST', {
          type: 'instrumental',
          scope: 'song',
          id: 'pdf-song',
          instrument: 'piano',
        })
      );

      expect(mocks.loadPartitionPdf).toHaveBeenCalledWith('piano.pdf');
      expect(mocks.loadPartitionPdf).not.toHaveBeenCalledWith('guitar.pdf');
    });

    it('intersects the requested files with the allowed set', async () => {
      mocks.resolveScopeSongs.mockResolvedValue({
        ...songWithParts,
        songs: [
          {
            songId: 'pdf-song',
            meta: { partitions: [{ instrument: 'guitar', file: 'guitar.pdf', title: 'G' }] },
            lang: null,
          },
        ],
      });

      await POST(
        createMockRequest('POST', {
          type: 'instrumental',
          scope: 'song',
          id: 'pdf-song',
          files: ['evil.pdf', 'guitar.pdf'],
        })
      );

      expect(mocks.loadPartitionPdf).toHaveBeenCalledTimes(1);
      expect(mocks.loadPartitionPdf).toHaveBeenCalledWith('guitar.pdf');
    });

    it('returns 400 when the scope has no partitions', async () => {
      mocks.resolveScopeSongs.mockResolvedValue({
        ...songWithParts,
        songs: [{ songId: 'pdf-song', meta: { partitions: [] }, lang: null }],
      });
      const response = await POST(
        createMockRequest('POST', { type: 'instrumental', scope: 'song', id: 'pdf-song' })
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No partitions');
    });

    it('returns 400 when no partitions are readable', async () => {
      mocks.resolveScopeSongs.mockResolvedValue({
        ...songWithParts,
        songs: [
          {
            songId: 'pdf-song',
            meta: { partitions: [{ instrument: 'guitar', file: 'guitar.pdf', title: 'G' }] },
            lang: null,
          },
        ],
      });
      mocks.loadPartitionPdf.mockResolvedValue(null);
      const response = await POST(
        createMockRequest('POST', { type: 'instrumental', scope: 'song', id: 'pdf-song' })
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No readable');
    });

    it('returns 404 when the instrumental scope is not found', async () => {
      mocks.resolveScopeSongs.mockResolvedValue(null);
      const response = await POST(
        createMockRequest('POST', { type: 'instrumental', scope: 'song', id: 'missing' })
      );
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/pdf', () => {
    it('returns 400 without a setlist parameter', async () => {
      const response = await GET(createMockRequest('GET', undefined, 'http://localhost/api/pdf'));
      expect(response.status).toBe(400);
    });

    it('returns 404 when the setlist does not exist', async () => {
      mocks.getSetlist.mockRejectedValue(new Error('missing'));
      const response = await GET(
        createMockRequest('GET', undefined, 'http://localhost/api/pdf?setlist=nope')
      );
      expect(response.status).toBe(404);
    });

    it('returns 404 when the setlist is not viewable', async () => {
      mocks.getSetlist.mockResolvedValue({ id: 's3', title: 'Private', public: false });
      const response = await GET(
        createMockRequest('GET', undefined, 'http://localhost/api/pdf?setlist=s3')
      );
      expect(response.status).toBe(404);
    });

    it('downloads a setlist PDF', async () => {
      const response = await GET(
        createMockRequest('GET', undefined, 'http://localhost/api/pdf?setlist=s1')
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      const url = puppeteerMocks.page.goto.mock.calls[0][0] as string;
      expect(url).toContain('/setlists/s1/print');
      expect(url).toContain('share=share-1');
    });

    it('returns 500 when PDF generation fails', async () => {
      puppeteerMocks.page.pdf.mockRejectedValueOnce(new Error('render failed'));
      const response = await GET(
        createMockRequest('GET', undefined, 'http://localhost/api/pdf?setlist=s1')
      );
      expect(response.status).toBe(500);
    });
  });
});
