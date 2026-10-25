import { describe, it, expect } from 'vitest';
import { parseMarkdown, parseInline, isSafeLinkUrl } from '@/lib/markdown';

describe('markdown', () => {
  it('parses headings, paragraphs and lists', () => {
    const blocks = parseMarkdown('# Title\n\nsome *text*\n\n- a\n- b\n\n1. x\n2. y');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list']);
    expect(blocks[2]).toMatchObject({ ordered: false });
    expect(blocks[3]).toMatchObject({ ordered: true });
  });

  it('keeps raw HTML as plain text', () => {
    const inline = parseInline('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(inline.every((n) => n.type === 'text')).toBe(true);
  });

  it('only turns http(s)/mailto urls into links', () => {
    expect(parseInline('[ok](https://example.com)')[0]).toMatchObject({ type: 'link' });
    expect(parseInline('[bad](javascript:alert(1))').some((n) => n.type === 'link')).toBe(false);
    expect(isSafeLinkUrl('data:text/html,x')).toBe(false);
    expect(isSafeLinkUrl('mailto:a@b.c')).toBe(true);
  });

  it('handles bold, code and fences', () => {
    expect(parseInline('**b** `c`').map((n) => n.type)).toEqual(['strong', 'text', 'code']);
    expect(parseMarkdown('```\nx <b>\n```')[0]).toEqual({ type: 'code', value: 'x <b>' });
  });
});
