import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatForFileName,
  acceptAttribute,
  convertFile,
  IMPORT_FORMATS,
} from '@/lib/chordpro/document-import';

const mocks = vi.hoisted(() => ({
  docxToChordPro: vi.fn(),
  pdfToChordPro: vi.fn(),
}));

vi.mock('@/lib/chordpro/docx-import', () => ({
  docxToChordPro: mocks.docxToChordPro,
}));

vi.mock('@/lib/chordpro/pdf-import', () => ({
  pdfToChordPro: mocks.pdfToChordPro,
}));

describe('chordpro/document-import.ts', () => {
  beforeEach(() => {
    mocks.docxToChordPro.mockReset();
    mocks.pdfToChordPro.mockReset();
  });

  describe('formatForFileName', () => {
    it('recognises docx, pdf and txt extensions', () => {
      expect(formatForFileName('song.docx')).toBe('docx');
      expect(formatForFileName('song.pdf')).toBe('pdf');
      expect(formatForFileName('song.txt')).toBe('txt');
      expect(formatForFileName('song.text')).toBe('txt');
    });

    it('is case insensitive', () => {
      expect(formatForFileName('SONG.DOCX')).toBe('docx');
      expect(formatForFileName('Song.Pdf')).toBe('pdf');
    });

    it('returns null for unknown extensions', () => {
      expect(formatForFileName('song.cho')).toBeNull();
      expect(formatForFileName('song')).toBeNull();
      expect(formatForFileName('song.doc')).toBeNull();
    });
  });

  describe('acceptAttribute', () => {
    it('lists all supported extensions', () => {
      expect(acceptAttribute()).toBe('.docx,.pdf,.txt,.text');
    });
  });

  describe('IMPORT_FORMATS', () => {
    it('contains the three formats', () => {
      expect(IMPORT_FORMATS).toEqual(['docx', 'pdf', 'txt']);
    });
  });

  describe('convertFile', () => {
    it('delegates docx files to docxToChordPro', async () => {
      const expected = { title: 'D', chordpro: 'd', detectedKey: null };
      mocks.docxToChordPro.mockResolvedValue(expected);
      const file = new File(['x'], 'song.docx');

      const result = await convertFile(file, 'docx');

      expect(mocks.docxToChordPro).toHaveBeenCalledWith(file);
      expect(result).toBe(expected);
    });

    it('delegates pdf files to pdfToChordPro', async () => {
      const expected = { title: 'P', chordpro: 'p', detectedKey: 'G' };
      mocks.pdfToChordPro.mockResolvedValue(expected);
      const file = new File(['x'], 'song.pdf');

      const result = await convertFile(file, 'pdf');

      expect(mocks.pdfToChordPro).toHaveBeenCalledWith(file);
      expect(result).toBe(expected);
    });

    it('parses txt files through txtToChordPro', async () => {
      const file = new File(['Title: Hi\n\nHello world'], 'song.txt');

      const result = await convertFile(file, 'txt');

      expect(result.title).toBe('Hi');
      expect(result.chordpro).toContain('Hello world');
    });
  });
});
