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
});
