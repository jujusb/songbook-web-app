import { describe, it, expect } from 'vitest';
import { renderVisualChordSheet } from '@/lib/chordpro/visual-render';

/** The opening `<div class="vce-line ...">` of the line containing `text`. */
function classOfLineWith(html: string, text: string): string {
  const line = html.split('\n').find((l) => l.includes(text) && l.includes('vce-line'));
  if (!line) throw new Error(`no line with text: ${text}`);
  return line;
}

describe('chorus lines are marked for bold display', () => {
  it('marks only lines inside a chorus section', () => {
    const html = renderVisualChordSheet(
      '{start_of_verse}\nVerse one\n{end_of_verse}\n{start_of_chorus}\nChorus line\n{end_of_chorus}\n{start_of_bridge}\nBridge line\n{end_of_bridge}\n',
      {}
    );
    expect(classOfLineWith(html, 'Chorus line')).toContain('vce-chorus');
    expect(classOfLineWith(html, 'Verse one')).not.toContain('vce-chorus');
    expect(classOfLineWith(html, 'Bridge line')).not.toContain('vce-chorus');
  });

  it('marks lines of a labeled chorus and resets at the next section', () => {
    const html = renderVisualChordSheet('{chorus: Refrain}\nSing it\n{verse}\nWords\n', {});
    expect(classOfLineWith(html, 'Sing it')).toContain('vce-chorus');
    expect(classOfLineWith(html, 'Words')).not.toContain('vce-chorus');
  });
});

describe('chorus chord alignment', () => {
  it('lays chorus lines out as segments so chords stay above their text', () => {
    const html = renderVisualChordSheet(
      '{start_of_chorus}\n[G]Sing [C]loud\n{end_of_chorus}\n{start_of_verse}\n[G]Plain [C]line\n{end_of_verse}\n',
      {}
    );
    const chorusLine = classOfLineWith(html, 'Sing');
    expect(chorusLine).toContain('vce-seg');
    expect(chorusLine).toContain('vce-chorus');
    expect(classOfLineWith(html, 'Plain')).not.toContain('vce-chorus');
  });
});
