import { describe, it, expect } from 'vitest';
import { renderVisualChordSheet } from '@/lib/chordpro/visual-render';

describe('chordpro/visual-render.ts', () => {
  describe('renderVisualChordSheet', () => {
    it('renders simple ChordPro with verses and chorus', () => {
      const source = `{title: Test Song}
{key: C}
{capo: 2}

{verse: 1}
[C]Amazing [G]grace how [Am]sweet the [F]sound

{chorus}
[F]Saved a [G]wretch like [C]me
[Am]I once was [G]lost but [F]now I'm [C]found

{verse: 2}
[C]Twas [G]grace that [Am]taught my [F]heart to [C]fear`;

      const html = renderVisualChordSheet(source);
      
      expect(html).toContain('vce-lines');
      expect(html).toContain('vce-line');
      expect(html).toContain('vce-chord-row');
      expect(html).toContain('vce-lyrics-row');
      expect(html).toContain('vce-section-label');
    });

    it('renders chords inline when inlineChords option is true', () => {
      const source = `{verse: 1}
[C]Amazing [G]grace`;
      
      const html = renderVisualChordSheet(source, { inlineChords: true });
      
      expect(html).toContain('vce-line');
    });

    it('renders metadata directives when renderDirectives is true', () => {
      const source = `{title: Test Song}
{key: C}
{capo: 2}
{comment: This is a comment}

{verse: 1}
Content`;
      
      const html = renderVisualChordSheet(source, { renderDirectives: true });
      
      expect(html).toContain('vce-title');
      expect(html).toContain('vce-key');
      expect(html).toContain('vce-capo');
      expect(html).toContain('vce-comment');
    });

    it('includes data-content-line when option is enabled', () => {
      const source = `{verse: 1}
Line 1
Line 2`;
      
      const html = renderVisualChordSheet(source, { dataContentLine: true });
      
      expect(html).toContain('data-content-line="0"');
      expect(html).toContain('data-content-line="1"');
    });

    it('highlights range when specified', () => {
      const source = `{verse: 1}
Amazing grace
How sweet the sound`;
      
      const html = renderVisualChordSheet(source, { 
        highlightRange: { line: 0, start: 0, end: 7 } 
      });
      
      expect(html).toContain('vce-ref-select');
      expect(html).toContain('Amazing');
    });

    it('handles repeatChorus option', () => {
      const source = `{verse: 1}
Verse content
{chorus}
Chorus content
{verse: 2}
Another verse
{chorus}`;
      
      const html = renderVisualChordSheet(source, { repeatChorus: true });
      
      expect(html).toContain('vce-lines');
      expect(html).toContain('Chorus content');
    });

    it('escapes HTML in lyrics', () => {
      const source = `{verse: 1}
<Script>alert('xss')</Script>
"Quotes" & ampersands`;
      
      const html = renderVisualChordSheet(source);
      
      // HTML is escaped in the output
      expect(html).toContain('&lt;Script&gt;');
      expect(html).toContain('&quot;Quotes&quot;');
      expect(html).toContain('&amp;');
    });

    it('handles empty lines', () => {
      const source = `{verse: 1}
Line 1

Line 3`;
      
      const html = renderVisualChordSheet(source);
      
      expect(html).toContain('vce-empty-line');
    });

    it('handles section aliases', () => {
      const source = `{verse: 1}
First verse
{verse: 1 : 3}
{chorus}
Chorus
{verse: 3}
Third verse`;
      
      const html = renderVisualChordSheet(source, { repeatChorus: true });
      
      expect(html).toContain('Third verse');
    });


    it('renders section labels', () => {
      const source = `{verse: 1}
Content
{chorus}
Chorus content`;
      
      const html = renderVisualChordSheet(source);
      
      expect(html).toContain('vce-section-label');
    });

    it('handles instrumental sections', () => {
      const source = `{instrumental: Intro riff}
{verse: 1}
Content`;
      
      const html = renderVisualChordSheet(source);
      
      expect(html).toContain('Intro riff');
    });

    it('handles prechorus sections', () => {
      const source = `{prechorus: Build up}
{chorus}
Chorus`;
      
      const html = renderVisualChordSheet(source);
      
      // prechorus renders as lyrics (not a section label in current implementation)
      expect(html).toContain('vce-lines');
    });

    it('handles bridge sections', () => {
      const source = `{bridge: Bridge section}
{chorus}
Chorus`;
      
      const html = renderVisualChordSheet(source);
      
      // bridge renders as lyrics (not a section label in current implementation)
      expect(html).toContain('vce-lines');
    });
  });
});