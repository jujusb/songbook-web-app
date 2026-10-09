import { describe, it, expect, beforeEach, vi } from 'vitest';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import {
  generatePdfFromUrl,
  extractSessionCookie,
  safePdfFilename,
  mergePdfBuffers,
} from '@/lib/pdf';

vi.mock('puppeteer', () => ({
  default: { launch: vi.fn() },
}));

const launch = vi.mocked(puppeteer.launch);

function makeBrowser(pdfBytes = new Uint8Array([1, 2, 3])) {
  const page = {
    setCookie: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(pdfBytes),
  };
  const browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { browser, page };
}

async function makePdf(pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return doc.save();
}

describe('pdf/index.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generatePdfFromUrl', () => {
    it('renders the URL and returns a plain ArrayBuffer', async () => {
      const { browser, page } = makeBrowser(new Uint8Array([10, 20, 30]));
      launch.mockResolvedValue(browser as any);

      const result = await generatePdfFromUrl('http://127.0.0.1/song');

      expect(ArrayBuffer.isView(result)).toBe(false);
      expect(new Uint8Array(result)).toEqual(new Uint8Array([10, 20, 30]));
      expect(page.goto).toHaveBeenCalledWith('http://127.0.0.1/song', {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });
      expect(page.setCookie).not.toHaveBeenCalled();
      expect(browser.close).toHaveBeenCalled();
    });

    it('forwards the session cookie when provided', async () => {
      const { browser, page } = makeBrowser();
      launch.mockResolvedValue(browser as any);

      await generatePdfFromUrl('http://127.0.0.1/setlist', 'session-token');

      expect(page.setCookie).toHaveBeenCalledWith({
        name: 'songbook-session',
        value: 'session-token',
        domain: '127.0.0.1',
        path: '/',
      });
    });

    it('closes the browser even when navigation fails', async () => {
      const { browser, page } = makeBrowser();
      page.goto.mockRejectedValue(new Error('goto failed'));
      launch.mockResolvedValue(browser as any);

      await expect(generatePdfFromUrl('http://127.0.0.1/broken')).rejects.toThrow(
        'goto failed',
      );
      expect(browser.close).toHaveBeenCalled();
    });
  });

  describe('extractSessionCookie', () => {
    it('returns null when there is no header', () => {
      expect(extractSessionCookie(null)).toBeNull();
      expect(extractSessionCookie('')).toBeNull();
    });

    it('extracts the session cookie from a cookie header', () => {
      expect(
        extractSessionCookie('foo=1; songbook-session=abc123; bar=2'),
      ).toBe('abc123');
    });

    it('preserves equals signs inside the value', () => {
      expect(extractSessionCookie('songbook-session=a=b=c')).toBe('a=b=c');
    });

    it('returns an empty string for an empty cookie value', () => {
      expect(extractSessionCookie('songbook-session=')).toBe('');
    });

    it('returns null when the cookie is absent', () => {
      expect(extractSessionCookie('foo=1; bar=2')).toBeNull();
    });
  });

  describe('safePdfFilename', () => {
    it('strips accents and replaces unsafe characters', () => {
      expect(safePdfFilename('Cántico de Gracia')).toBe('Cantico-de-Gracia');
      expect(safePdfFilename('Hello, World!')).toBe('Hello-World');
    });

    it('trims leading and trailing dashes', () => {
      expect(safePdfFilename('  ***Song***  ')).toBe('Song');
    });

    it('falls back to "setlist" for empty output', () => {
      expect(safePdfFilename('***')).toBe('setlist');
      expect(safePdfFilename('')).toBe('setlist');
    });

    it('caps the filename at 80 characters', () => {
      const result = safePdfFilename('a'.repeat(200));
      expect(result).toHaveLength(80);
    });
  });

  describe('mergePdfBuffers', () => {
    it('merges the pages of multiple PDFs', async () => {
      const a = await makePdf(2);
      const b = await makePdf(1);
      const merged = await mergePdfBuffers([a, b]);
      const doc = await PDFDocument.load(merged);
      expect(doc.getPageCount()).toBe(3);
    });

    it('returns a one-page document for an empty chunk', async () => {
      const merged = await mergePdfBuffers([]);
      const doc = await PDFDocument.load(merged);
      expect(doc.getPageCount()).toBe(1);
    });

    it('skips buffers that cannot be parsed', async () => {
      const valid = await makePdf(1);
      const merged = await mergePdfBuffers([new Uint8Array([1, 2, 3]), valid]);
      const doc = await PDFDocument.load(merged);
      expect(doc.getPageCount()).toBe(1);
    });
  });
});
