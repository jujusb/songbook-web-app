import { describe, it, expect } from 'vitest';
import { noteApplicableLanguages } from '@/lib/notes';

const site = ['en-US', 'es-ES', 'fr-FR'];

describe('noteApplicableLanguages', () => {
  it('uses all site languages when no API section restricts them', () => {
    expect(noteApplicableLanguages([{ type: 'manual', md: '' }], site)).toEqual(site);
    expect(noteApplicableLanguages([{ type: 'api', languages: [] }], site)).toEqual(site);
    expect(noteApplicableLanguages(undefined, site)).toEqual(site);
  });

  it('restricts to the API applicable languages in site order', () => {
    const sections = [
      { type: 'manual' as const, md: '' },
      { type: 'api' as const, languages: ['fr-FR', 'en-US'] },
    ];
    expect(noteApplicableLanguages(sections, site)).toEqual(['en-US', 'fr-FR']);
  });

  it('ignores selected codes that are not configured site languages', () => {
    const sections = [{ type: 'api' as const, languages: ['de-DE'] }];
    expect(noteApplicableLanguages(sections, site)).toEqual(site);
  });
});
