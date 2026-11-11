import { describe, it, expect } from 'vitest';
import {
  SetlistSchema,
  SetlistItemSchema,
  isSongItem,
  isNoteItem,
  isLinkItem,
  isHttpUrl,
} from '@/lib/content/schemas';

describe('setlist items', () => {
  it('treats legacy items without type as songs', () => {
    const item = SetlistItemSchema.parse({ songId: 's1', lang: 'en' });
    expect(item).toEqual({ type: 'song', songId: 's1', lang: 'en' });
    expect(isSongItem(item)).toBe(true);
  });

  it('parses a setlist with mixed items and keeps order', () => {
    const parsed = SetlistSchema.parse({
      id: 'x',
      title: 'X',
      songs: [
        { songId: 's1', lang: 'en' },
        { type: 'note', id: 'n', text: 'hello' },
        { type: 'link', id: 'l', url: 'https://example.com' },
      ],
    });
    expect(parsed.songs.map((i) => i.type)).toEqual(['song', 'note', 'link']);
    expect(isNoteItem(parsed.songs[1])).toBe(true);
    expect(isLinkItem(parsed.songs[2])).toBe(true);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://x.org', 'not a url', ''])(
    'rejects link url %s',
    (url) => {
      expect(SetlistItemSchema.safeParse({ type: 'link', id: 'l', url }).success).toBe(false);
      expect(isHttpUrl(url)).toBe(false);
    },
  );

  it('rejects overly long notes', () => {
    expect(SetlistItemSchema.safeParse({ type: 'note', id: 'n', text: 'a'.repeat(5001) }).success).toBe(false);
  });

  it('accepts absolute and app-relative image URLs', () => {
    const base = { id: 'x', title: 'X', songs: [] };
    expect(SetlistSchema.safeParse({ ...base, image: 'https://example.com/a.jpg' }).success).toBe(true);
    expect(SetlistSchema.safeParse({ ...base, image: '/api/images/a.png' }).success).toBe(true);
  });

  it.each(['//evil.example/a.png', '/\\\\evil.example/a.png', 'javascript:alert(1)', 'data:image/png;base64,x'])(
    'rejects unsafe image url %s',
    (image) => {
      expect(SetlistSchema.safeParse({ id: 'x', title: 'X', songs: [], image }).success).toBe(false);
    },
  );
});
