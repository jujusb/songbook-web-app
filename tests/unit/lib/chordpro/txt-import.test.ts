import { describe, it, expect } from 'vitest';
import { txtToChordPro } from '@/lib/chordpro/txt-import';

describe('chordpro/txt-import.ts', () => {
  describe('txtToChordPro', () => {
    it('merges chords-above-lyrics into inline ChordPro', () => {
      const input = [
        '{title: Amazing Grace}',
        '',
        'Amazing Grace',
        'C        G',
        'Amazing grace how sweet the sound',
      ].join('\n');

      const { chordpro, title } = txtToChordPro(input);

      expect(title).toBe('Amazing Grace');
      expect(chordpro).toContain('{title: Amazing Grace}');
      expect(chordpro).toContain('[C]Amazing');
      expect(chordpro).toContain('[G]grace');
      expect(chordpro).toContain('{start_of_verse: Verse}');
      expect(chordpro).toContain('{end_of_verse}');
    });

    it('handles already-inline bracket chords', () => {
      const input = '{title: T}\n[Am]Amazing [G]grace';

      const { chordpro } = txtToChordPro(input);

      expect(chordpro).toContain('[Am]Amazing [G]grace');
      expect(chordpro).toContain('{start_of_verse: Verse}');
    });

    it('recognises English, Spanish and French section headers', () => {
      const input = [
        '{title: T}',
        'Chorus',
        'Santo',
        '',
        'Estribillo',
        'Coro santo',
        '',
        'Couplet',
        'Bonjour',
      ].join('\n');

      const { chordpro } = txtToChordPro(input);

      expect(chordpro).toContain('{start_of_chorus: Chorus}');
      expect(chordpro).toContain('{start_of_chorus: Estribillo}');
      expect(chordpro).toContain('{start_of_verse: Couplet}');
    });

    it('extracts title from a Title: prefix and strips numbering', () => {
      const input = ['Title: 1. My Great Song', '', 'C G', 'La la la'].join('\n');

      const result = txtToChordPro(input);

      expect(result.title).toBe('My Great Song');
      expect(result.chordpro).toContain('{title: My Great Song}');
      expect(result.chordpro).not.toContain('Title:');
    });

    it('extracts title from {title:} directive', () => {
      const result = txtToChordPro('{title: Glorious}\n\nHello');

      expect(result.title).toBe('Glorious');
      expect(result.chordpro).toContain('{title: Glorious}');
    });

    it('detects the key from a Key: line', () => {
      const input = ['Title: Song', 'Key: Am', 'C G', 'La'].join('\n');

      const result = txtToChordPro(input);

      expect(result.detectedKey).toBe('Am');
      expect(result.chordpro).toContain('{key: Am}');
    });

    it('detects the key from a {key:} directive', () => {
      const input = ['{title: Song}', '{key: G}', 'G D', 'La'].join('\n');

      const result = txtToChordPro(input);

      expect(result.detectedKey).toBe('G');
    });

    it('converts capo lines to {capo:}', () => {
      const input = ['Title: C', 'Capo 3', 'Hello world'].join('\n');

      const result = txtToChordPro(input);

      expect(result.chordpro).toContain('{capo: 3}');
    });

    it('converts citation lines to comments', () => {
      const input = ['Title: C', 'Jn 3,16', 'For God so loved'].join('\n');

      const result = txtToChordPro(input);

      expect(result.chordpro).toContain('{comment: Jn 3,16}');
    });

    it('splits stanzas on blank lines into numbered verses', () => {
      const input = [
        '{title: Song}',
        'First stanza line',
        '',
        'Second stanza line',
      ].join('\n');

      const { chordpro } = txtToChordPro(input);

      expect(chordpro).toContain('{start_of_verse: Verse}');
      expect(chordpro).toContain('{start_of_verse: Verse 2}');
      expect(chordpro).toContain('First stanza line');
      expect(chordpro).toContain('Second stanza line');
    });

    it('handles chords-only lines', () => {
      const input = ['{title: T}', 'C G Am F', '', 'C G', 'Hello there'].join('\n');

      const { chordpro } = txtToChordPro(input);

      expect(chordpro).toContain('[C] [G] [Am] [F]');
      expect(chordpro).toContain('Hello there');
    });

    it('distributes chords proportionally when columns overshoot lyrics', () => {
      const input = [
        '{title: Overshoot}',
        'C           G           D',
        'Short',
      ].join('\n');

      const { chordpro } = txtToChordPro(input);

      expect(chordpro).toContain('[C]');
      expect(chordpro).toContain('[G]');
      expect(chordpro).toContain('[D]');
      expect(chordpro).toContain('Short');
    });

    it('passes through already-inline ChordPro directives', () => {
      const input = [
        '{start_of_verse: Verse 1}',
        '[C]Hello',
        '{end_of_verse}',
        '{start_of_intro: Solo}',
        '[A] [E]',
        '{end_of_intro}',
      ].join('\n');

      const { chordpro } = txtToChordPro(input);

      expect(chordpro).toContain('{start_of_verse: Verse 1}');
      expect(chordpro).toContain('{end_of_verse}');
      // intro is normalised to instrumental
      expect(chordpro).toContain('{start_of_instrumental: Solo}');
      expect(chordpro).toContain('{end_of_instrumental}');
    });

    it('normalises accidental-after-quality chords during merge', () => {
      const input = ['{title: T}', 'Fm#        Cm#', 'Lyric line here'].join('\n');

      const { chordpro } = txtToChordPro(input);

      expect(chordpro).toContain('[F#m]');
      expect(chordpro).toContain('[C#m]');
    });

    it('handles empty input', () => {
      const result = txtToChordPro('');

      expect(result.title).toBeNull();
      expect(result.detectedKey).toBeNull();
      expect(result.chordpro).toBe('');
    });

    it('treats a leading chord line as chords-only when followed by a section header', () => {
      const input = ['{title: T}', 'C G', 'Chorus', 'Sing'].join('\n');

      const { chordpro } = txtToChordPro(input);

      expect(chordpro).toContain('[C] [G]');
      expect(chordpro).toContain('{start_of_chorus: Chorus}');
    });

    it('renders inline chords from a section header', () => {
      const input = ['{title: T}', 'Intro: C G Am F'].join('\n');

      const { chordpro } = txtToChordPro(input);

      expect(chordpro).toContain('{start_of_instrumental: Intro}');
      expect(chordpro).toContain('[C][ - ]');
      expect(chordpro).toContain('[F]');
    });
  });
});
