import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTextItemsFromPDF, pdfToChordPro } from '@/lib/chordpro/pdf-import';

const { getDocumentMock } = vi.hoisted(() => ({ getDocumentMock: vi.fn() }));

vi.mock('pdfjs-dist', () => ({ getDocument: getDocumentMock }));

interface RawItem {
  str: string;
  transform: number[];
  height?: number;
  fontSize?: number;
}

function item(str: string, x: number, yTop: number, height = 12): RawItem {
  return { str, transform: [1, 0, 0, 1, x, yTop], height };
}

function makePdf(pages: RawItem[][]) {
  return {
    numPages: pages.length,
    getPage: async (p: number) => ({
      getViewport: () => ({ height: 100 }),
      getTextContent: async () => ({ items: pages[p - 1] }),
    }),
  };
}

function makeFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'song.pdf');
}

describe('chordpro/pdf-import.ts', () => {
  beforeEach(() => {
    getDocumentMock.mockReset();
  });

  describe('extractTextItemsFromPDF', () => {
    it('maps pdf text items into coordinates', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.resolve(makePdf([[item('Hi', 50, 10, 14)]])),
      });

      const { items, numPages } = await extractTextItemsFromPDF(makeFile());

      expect(numPages).toBe(1);
      expect(items[0]).toEqual({ text: 'Hi', x: 50, y: 90, fontSize: 14 });
      expect(getDocumentMock).toHaveBeenCalledWith({ data: expect.any(ArrayBuffer) });
    });

    it('falls back to item.fontSize when height is absent', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.resolve(
          makePdf([[{ str: 'X', transform: [1, 0, 0, 1, 10, 20], fontSize: 9 }]]),
        ),
      });

      const { items } = await extractTextItemsFromPDF(makeFile());

      expect(items[0].fontSize).toBe(9);
    });
  });

  describe('pdfToChordPro', () => {
    it('returns empty results for a PDF with no text', async () => {
      getDocumentMock.mockReturnValue({ promise: Promise.resolve(makePdf([[]])) });

      const result = await pdfToChordPro(makeFile());

      expect(result).toEqual({ title: null, chordpro: '', detectedKey: null });
    });

    it('merges chord lines above lyrics', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.resolve(
          makePdf([
            [
              item('Amazing Grace', 50, 10, 14),
              item('C ', 50, 30),
              item('G ', 150, 30),
              item('Amazing grace', 50, 50),
            ],
          ]),
        ),
      });

      const result = await pdfToChordPro(makeFile());

      expect(result.title).toBe('Amazing Grace');
      expect(result.chordpro).toContain('{title: Amazing Grace}');
      expect(result.chordpro).toContain('[C]');
      expect(result.chordpro).toContain('[G]');
      expect(result.chordpro).toContain('Amazing');
    });

    it('extracts a Title: prefix', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.resolve(
          makePdf([[item('Title: My Song', 50, 10), item('[C]Hello', 50, 30)]]),
        ),
      });

      const result = await pdfToChordPro(makeFile());

      expect(result.title).toBe('My Song');
      expect(result.chordpro).toContain('{title: My Song}');
      expect(result.chordpro).toContain('[C]Hello');
    });

    it('extracts a Key: line', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.resolve(
          makePdf([[item('Song', 50, 10), item('Key: G', 50, 30), item('La la', 50, 50)]]),
        ),
      });

      const result = await pdfToChordPro(makeFile());

      expect(result.detectedKey).toBe('G');
      expect(result.chordpro).toContain('{key: G}');
    });

    it('converts citation lines to comments', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.resolve(
          makePdf([[item('Song', 50, 10), item('Jn 3,16', 50, 30), item('For God', 50, 50)]]),
        ),
      });

      const result = await pdfToChordPro(makeFile());

      expect(result.chordpro).toContain('{comment: Jn 3,16}');
    });

    it('handles section headers', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.resolve(
          makePdf([
            [item('Song Title', 50, 10), item('(Estribillo)', 50, 30), item('Santo', 50, 50)],
          ]),
        ),
      });

      const result = await pdfToChordPro(makeFile());

      expect(result.chordpro).toContain('{start_of_chorus: Estribillo}');
      expect(result.chordpro).toContain('Santo');
    });

    it('falls back to txt import when no ChordPro can be built', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.resolve(makePdf([[item('   ', 50, 10)]])),
      });

      const result = await pdfToChordPro(makeFile());

      expect(result.chordpro).toBe('');
      expect(result.title).toBeNull();
    });

    it('processes multi-column layouts independently', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.resolve(
          makePdf([
            [
              item('Song A', 50, 10),
              item('Line A', 50, 30),
              item('Song B', 500, 10),
              item('Line B', 500, 30),
            ],
          ]),
        ),
      });

      const result = await pdfToChordPro(makeFile());

      expect(result.title).toBe('Song A');
      expect(result.chordpro).toContain('Song A');
      expect(result.chordpro).toContain('Line A');
      expect(result.chordpro).toContain('Song B');
      expect(result.chordpro).toContain('Line B');
    });
  });
});
