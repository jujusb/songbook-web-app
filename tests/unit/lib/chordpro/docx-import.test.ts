import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mammoth from 'mammoth';
import { docxToChordPro } from '@/lib/chordpro/docx-import';

vi.mock('mammoth', () => ({
  convertToHtml: vi.fn(),
}));

const convertToHtml = vi.mocked(mammoth.convertToHtml);

function makeFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'song.docx');
}

describe('chordpro/docx-import.ts', () => {
  beforeEach(() => {
    convertToHtml.mockReset();
  });

  it('converts paragraphs and detects the title', async () => {
    convertToHtml.mockResolvedValue({
      value: '<p>Title: My Song</p><p>[C]Hello world</p>',
    } as never);

    const result = await docxToChordPro(makeFile());

    expect(result.title).toBe('My Song');
    expect(result.chordpro).toContain('{title: My Song}');
    expect(result.chordpro).toContain('[C]Hello world');
  });

  it('decodes common HTML entities and line breaks', async () => {
    convertToHtml.mockResolvedValue({
      value: '<p>A &amp; B &lt;tag&gt; &quot;q&quot; &#39;s&#39; &nbsp;end<br/>next</p>',
    } as never);

    const result = await docxToChordPro(makeFile());

    expect(result.chordpro).toContain('A & B <tag> "q" \'s\'');
    expect(result.chordpro).toContain('next');
  });

  it('expands a table column by column', async () => {
    convertToHtml.mockResolvedValue({
      value: [
        '<table>',
        '<tr><td>Col1 line1</td><td>Col2 line1</td></tr>',
        '<tr><td>Col1 line2</td><td>Col2 line2</td></tr>',
        '</table>',
      ].join(''),
    } as never);

    const result = await docxToChordPro(makeFile());

    expect(result.chordpro).toContain('Col1 line1');
    expect(result.chordpro).toContain('Col1 line2');
    expect(result.chordpro).toContain('Col2 line1');
    expect(result.chordpro).toContain('Col2 line2');
  });

  it('merges a bare section-header cell with the following stanza', async () => {
    convertToHtml.mockResolvedValue({
      value: [
        '<table>',
        '<tr><td>(Estribillo final)</td></tr>',
        '<tr><td>Coro santo</td></tr>',
        '</table>',
      ].join(''),
    } as never);

    const result = await docxToChordPro(makeFile());

    expect(result.chordpro).toContain('{start_of_chorus: Estribillo final}');
    expect(result.chordpro).toContain('Coro santo');
  });

  it('keeps a trailing section-header cell', async () => {
    convertToHtml.mockResolvedValue({
      value: [
        '<table>',
        '<tr><td>Verse 1</td></tr>',
        '<tr><td>Line one</td></tr>',
        '<tr><td>(Bridge)</td></tr>',
        '</table>',
      ].join(''),
    } as never);

    const result = await docxToChordPro(makeFile());

    expect(result.chordpro).toContain('Line one');
    expect(result.chordpro).toContain('Bridge');
  });

  it('skips empty cells and rows of differing width', async () => {
    convertToHtml.mockResolvedValue({
      value: [
        '<table>',
        '<tr><td></td><td></td></tr>',
        '<tr><td>Only one</td></tr>',
        '</table>',
      ].join(''),
    } as never);

    const result = await docxToChordPro(makeFile());

    expect(result.chordpro).toContain('Only one');
  });

  it('captures text between and after blocks', async () => {
    convertToHtml.mockResolvedValue({
      value: '<p>One</p>middle<div>Two</div>',
    } as never);

    const result = await docxToChordPro(makeFile());

    expect(result.chordpro).toContain('One');
    expect(result.chordpro).toContain('middle');
    expect(result.chordpro).toContain('Two');
  });

  it('falls back to the buffer form when arrayBuffer fails', async () => {
    convertToHtml
      .mockRejectedValueOnce(new Error('arrayBuffer not supported'))
      .mockResolvedValueOnce({ value: '<p>Fallback works</p>' } as never);

    const result = await docxToChordPro(makeFile());

    expect(convertToHtml).toHaveBeenCalledTimes(2);
    expect(convertToHtml.mock.calls[1][0]).toHaveProperty('buffer');
    expect(result.chordpro).toContain('Fallback works');
  });
});
