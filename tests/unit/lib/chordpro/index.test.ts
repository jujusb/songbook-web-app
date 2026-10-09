import { describe, it, expect } from 'vitest';
import {
  parseChordPro,
  renderToHtml,
  transpose,
  getKey,
  renderReferencesHtml,
} from '@/lib/chordpro';

describe('chordpro/index.ts', () => {
  describe('parseChordPro', () => {
    it('parses metadata and lyrics', () => {
      const song = parseChordPro('{title: My Song}\n{key: G}\n[C]Hello');
      expect(song.title).toBe('My Song');
      expect(song.key).toBe('G');
      expect(song.lines.length).toBeGreaterThan(0);
    });
  });

  describe('transpose', () => {
    it('transposes chords by semitones', () => {
      const result = transpose('{key: C}\n[C]Hello', 2);
      expect(result).toContain('[D]Hello');
      expect(result).not.toContain('[C]Hello');
    });

    it('transposes down', () => {
      const result = transpose('[C]Hello', -2);
      expect(result).toContain('[Bb]Hello');
    });
  });

  describe('getKey', () => {
    it('returns the key directive value', () => {
      expect(getKey('{key: G}\n[C]Hi')).toBe('G');
    });

    it('returns null when there is no key', () => {
      expect(getKey('{title: X}\n[C]Hi')).toBeNull();
    });
  });

  describe('renderToHtml', () => {
    it('renders a chord sheet to HTML', () => {
      const html = renderToHtml('{title: T}\n{verse: 1}\n[C]Hello');
      expect(html).toContain('vce-lines');
    });

    it('forwards inlineChords and repeatChorus options', () => {
      const html = renderToHtml('{verse: 1}\n[C]Hello', { inlineChords: true });
      expect(typeof html).toBe('string');
      expect(html).toContain('vce-line');
    });
  });

  describe('renderReferencesHtml', () => {
    it('returns an empty string for no references', () => {
      expect(renderReferencesHtml([])).toBe('');
    });

    it('renders a bible reference with text and highlight', () => {
      const html = renderReferencesHtml([
        {
          type: 'bible',
          label: 'John 3:16',
          target: 'Jn 3,16',
          text: 'For God so loved the world',
          highlight: 'God',
        },
      ]);

      expect(html).toContain('<div class="song-references">');
      expect(html).toContain('<li>');
      expect(html).toContain('John 3:16');
      expect(html).toContain('<div class="ref-text">');
      expect(html).toContain('<mark>God</mark>');
    });

    it('renders song references as internal links', () => {
      const html = renderReferencesHtml([
        { type: 'song', label: 'Amazing Grace', target: 'amazing-grace' },
      ]);
      expect(html).toContain('<a href="/songs/amazing-grace">Amazing Grace</a>');
    });

    it('renders link references as external links', () => {
      const html = renderReferencesHtml([
        { type: 'link', label: 'Example', target: 'https://example.com' },
      ]);
      expect(html).toContain(
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Example</a>',
      );
    });

    it('renders non-link types as plain escaped labels', () => {
      const html = renderReferencesHtml([
        { type: 'text', label: 'A <b>note</b>', target: '' },
      ]);
      expect(html).toContain('A &lt;b&gt;note&lt;/b&gt;');
      expect(html).not.toContain('<a ');
    });

    it('uses language-specific text and highlight', () => {
      const html = renderReferencesHtml(
        [
          {
            type: 'bible',
            label: 'Juan 3:16',
            target: 'Jn 3,16',
            text: 'default',
            texts: { es: 'Porque de tal manera' },
            highlight: 'zzz',
            highlights: { es: 'tal' },
          },
        ],
        'es',
      );
      expect(html).toContain('Porque de ');
      expect(html).toContain(' manera');
      expect(html).toContain('<mark>tal</mark>');
    });

    it('does not mark when the highlight is absent from the text', () => {
      const html = renderReferencesHtml([
        {
          type: 'bible',
          label: 'John',
          target: 'Jn',
          text: 'Hello world',
          highlight: 'zzz',
        },
      ]);
      expect(html).not.toContain('<mark>');
      expect(html).toContain('Hello world');
    });

    it('escapes labels without text', () => {
      const html = renderReferencesHtml([
        { type: 'bible', label: '<script>', target: 'Jn' },
      ]);
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<div class="ref-text">');
    });
  });
});
