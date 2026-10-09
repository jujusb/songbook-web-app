import { describe, it, expect } from 'vitest';
import {
  youtubeIdFromUrl,
  youtubePlaylistIdFromUrl,
} from '@/lib/youtube';

describe('youtube.ts', () => {
  describe('youtubeIdFromUrl', () => {
    it('extracts from watch URLs', () => {
      expect(youtubeIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      );
      expect(
        youtubeIdFromUrl('https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ&t=10'),
      ).toBe('dQw4w9WgXcQ');
    });

    it('extracts from short youtu.be URLs', () => {
      expect(youtubeIdFromUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(youtubeIdFromUrl('https://www.youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts from embed, shorts and live URLs', () => {
      expect(youtubeIdFromUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      );
      expect(youtubeIdFromUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      );
      expect(youtubeIdFromUrl('https://youtube.com/live/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      );
    });

    it('trims surrounding whitespace', () => {
      expect(youtubeIdFromUrl('  https://youtu.be/dQw4w9WgXcQ  ')).toBe(
        'dQw4w9WgXcQ',
      );
    });

    it('extracts a v= query parameter regardless of host', () => {
      expect(youtubeIdFromUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      );
    });

    it('returns null for unrecognized input', () => {
      expect(youtubeIdFromUrl('https://example.com/not-a-video')).toBeNull();
      expect(youtubeIdFromUrl('https://youtu.be/short')).toBeNull();
      expect(youtubeIdFromUrl('')).toBeNull();
    });
  });

  describe('youtubePlaylistIdFromUrl', () => {
    it('extracts from playlist query URLs', () => {
      expect(
        youtubePlaylistIdFromUrl('https://www.youtube.com/playlist?list=PLabc123'),
      ).toBe('PLabc123');
      expect(
        youtubePlaylistIdFromUrl('https://www.youtube.com/watch?list=PLxyz_-9'),
      ).toBe('PLxyz_-9');
    });

    it('extracts from embed videoseries URLs', () => {
      expect(
        youtubePlaylistIdFromUrl(
          'https://www.youtube.com/embed/videoseries?list=PLabc123',
        ),
      ).toBe('PLabc123');
    });

    it('returns null for unrecognized input', () => {
      expect(youtubePlaylistIdFromUrl('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
      expect(youtubePlaylistIdFromUrl('')).toBeNull();
    });
  });
});
