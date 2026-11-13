import { describe, it, expect } from 'vitest';
import { extractApiSectionText, formatApiSectionPreview, resolveNoteLanguage } from '@/lib/notes';

const data = {
  celebrations: [
    {
      readings: [
        {
          type: 'READING',
          labels: { 'es-ES': 'Primera lectura' },
          variants: [
            {
              texts: {
                'es-ES': {
                  citation_raw: 'Flp 3, 3-8',
                  title: null,
                  refrain: null,
                  text: 'Hermanos: todo lo considero pérdida.',
                },
              },
            },
          ],
        },
        {
          type: 'PSALM',
          labels: { 'es-ES': 'Salmo responsorial' },
          variants: [
            {
              texts: {
                'es-ES': {
                  citation_raw: 'Sal 104, 2-7',
                  title: null,
                  refrain: 'R. Aleluya.',
                  text: 'Cantadle al son de instrumentos.',
                },
              },
            },
          ],
        },
      ],
    },
  ],
};

const section = {
  type: 'api',
  resultSection: 'celebrations[].readings[]',
  discriminator: 'type',
  showDiscriminator: false,
  discriminatorValues: [
    {
      name: 'READING',
      style: 'plain',
      fieldsOrdered: [
        { name: 'labels.es-ES', style: 'h2' },
        { name: 'variants[0].texts.es-ES.citation_raw', style: 'italic' },
        { name: 'variants[0].texts.es-ES.refrain', style: 'bold' },
        { name: 'variants[0].texts.es-ES.text', style: 'plain' },
      ],
    },
    {
      name: 'PSALM',
      style: 'plain',
      fieldsOrdered: [
        { name: 'labels.es-ES', style: 'h2' },
        { name: 'variants[0].texts.es-ES.citation_raw', style: 'italic' },
        { name: 'variants[0].texts.es-ES.refrain', style: 'bold' },
        { name: 'variants[0].texts.es-ES.text', style: 'plain' },
      ],
    },
  ],
};

describe('extractApiSectionText nested mapping', () => {
  it('resolves nested per-type fields and skips empty values', () => {
    const out = extractApiSectionText(section as never, data);

    expect(out).toContain('## Primera lectura');
    expect(out).toContain('_Flp 3, 3-8_');
    expect(out).toContain('Hermanos: todo lo considero pérdida.');
    expect(out).toContain('## Salmo responsorial');
    expect(out).toContain('**R. Aleluya.**');
    expect(out).toContain('Cantadle al son de instrumentos.');
    expect(out).not.toContain('****');
    expect(out).not.toContain('"variants"');
  });

  it('uses fallback when a mapped field is empty', () => {
    const dataWithoutRefrain = {
      celebrations: [
        {
          readings: [
            {
              type: 'PSALM',
              labels: { 'es-ES': 'Salmo responsorial' },
              variants: [
                {
                  texts: {
                    'es-ES': {
                      citation_raw: 'Sal 104, 2-7',
                      title: null,
                      refrain: null,
                      text: 'Cantadle al son de instrumentos.',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const sectionWithFallback = {
      ...section,
      discriminatorValues: section.discriminatorValues.map((dv) =>
        dv.name === 'PSALM'
          ? {
              ...dv,
              fieldsOrdered: dv.fieldsOrdered.map((f) =>
                f.name.endsWith('.refrain') ? { ...f, fallback: 'R.' } : f,
              ),
            }
          : dv,
      ),
    };

    const out = extractApiSectionText(sectionWithFallback as never, dataWithoutRefrain);

    expect(out).toContain('## Salmo responsorial');
    expect(out).toContain('**R.**');
    expect(out).toContain('Cantadle al son de instrumentos.');
  });

  it('renders liturgical day header fields with labels', () => {
    const headerSection = {
      type: 'api',
      resultSection: 'liturgical_day',
      discriminator: 'none',
      fields: [
        { name: 'rank_names.es-ES', style: 'h2' },
        { name: 'names.es-ES', label: 'Nombre', style: 'plain' },
        { name: 'season_names.es-ES', label: 'Temporada', style: 'plain' },
        { name: 'color_names.es-ES', label: 'Color', style: 'plain' },
      ],
    };
    const headerData = {
      liturgical_day: {
        rank_names: { 'es-ES': 'Feria' },
        names: { 'es-ES': 'peter_poveda_and_companions_martyrs' },
        season_names: { 'es-ES': 'Desconocido' },
        color_names: { 'es-ES': 'Desconocido' },
      },
    };

    const out = extractApiSectionText(headerSection as never, headerData);

    expect(out).toContain('## Feria');
    expect(out).toContain('Nombre: peter_poveda_and_companions_martyrs');
    expect(out).toContain('Temporada: Desconocido');
    expect(out).toContain('Color: Desconocido');
  });
});

describe('formatApiSectionPreview', () => {
  it('returns formatted text for a mapped part', () => {
    const result = formatApiSectionPreview(section as never, data);

    expect(result.tabs).toBeUndefined();
    expect(result.text).toContain('## Primera lectura');
    expect(result.text).toContain('**R. Aleluya.**');
  });

  it('returns tabs with their formatted text inside', () => {
    const tabsSection = {
      type: 'api',
      resultSection: 'messes[]',
      discriminator: 'none',
      fields: [
        { name: 'ref', style: 'italic' },
        { name: 'contenu', style: 'plain' },
      ],
    };
    const tabsData = {
      messes: [
        {
          titre: 'Messe du jour',
          lectures: [{ ref: 'Jn 3, 16', contenu: 'Dieu a tant aimé le monde.' }],
        },
        {
          titre: 'Messe de la veille',
          lectures: [{ ref: 'Mc 1, 1', contenu: 'Commencement de l’Évangile.' }],
        },
      ],
    };

    const result = formatApiSectionPreview(tabsSection as never, tabsData);

    expect(result.text).toBe('');
    expect(result.tabs).toHaveLength(2);
    expect(result.tabs?.[0].title).toBe('Messe du jour');
    expect(result.tabs?.[0].text).toContain('_Jn 3, 16_');
    expect(result.tabs?.[0].text).toContain('Dieu a tant aimé le monde.');
    expect(result.tabs?.[1].title).toBe('Messe de la veille');
    expect(result.tabs?.[1].text).toContain('Commencement de l’Évangile.');
  });
});

describe('language placeholders in mapping paths', () => {
  it('interpolates $LANG in result section and field paths', () => {
    const langSection = {
      type: 'api',
      resultSection: 'liturgical_day',
      discriminator: 'none',
      fields: [
        { name: 'rank_names.$LANG', style: 'h2' },
        { name: 'names.$LANG', label: 'Nombre' },
        { name: 'variants[0].texts.$LANG.citation_raw', style: 'italic' },
      ],
    };
    const langData = {
      liturgical_day: {
        rank_names: { 'fr-FR': 'Férie' },
        names: { 'fr-FR': 'Pierre' },
        variants: [{ texts: { 'fr-FR': { citation_raw: 'Jn 3, 16' } } }],
      },
    };

    const out = extractApiSectionText(langSection as never, langData, 'fr-FR');

    expect(out).toContain('## Férie');
    expect(out).toContain('Nombre: Pierre');
    expect(out).toContain('_Jn 3, 16_');
  });

  it('adds a blank line between every line for French output', () => {
    const frSection = {
      type: 'api',
      resultSection: 'liturgical_day',
      discriminator: 'none',
      fields: [
        { name: 'names.$LANG', style: 'h2' },
        { name: 'rank_names.$LANG', style: 'plain' },
        { name: 'color_names.$LANG', style: 'plain' },
      ],
    };
    const frData = {
      liturgical_day: {
        names: { 'fr-FR': 'Férie' },
        rank_names: { 'fr-FR': 'Vert' },
        color_names: { 'fr-FR': 'Vert' },
      },
    };

    const out = extractApiSectionText(frSection as never, frData, 'fr-FR');

    expect(out).toBe('## Férie\n\nVert\n\nVert');
  });

  it('separates French array items with a blank line', () => {
    const frSection = {
      type: 'api',
      resultSection: 'items[]',
      discriminator: 'none',
      fields: [{ name: 'text', style: 'plain' }],
    };
    const frData = { items: [{ text: 'un\ndeux' }, { text: 'trois' }] };

    const out = extractApiSectionText(frSection as never, frData, 'fr-FR');

    expect(out).toBe('un\n\ndeux\n\ntrois');
  });

  it('normalizes single newlines inside French text', () => {
    const frSection = {
      type: 'api',
      resultSection: '',
      discriminator: 'none',
      fields: [{ name: 'text', style: 'plain' }],
    };

    const out = extractApiSectionText(frSection as never, { text: 'ligne 1\nligne 2\n\nligne 3' }, 'fr-FR');

    expect(out).toBe('ligne 1\n\nligne 2\n\nligne 3');
  });

  it('formats previews using $LANG mappings', () => {
    const langSection = {
      type: 'api',
      resultSection: 'celebrations[].readings[]',
      discriminator: 'type',
      discriminatorValues: [
        {
          name: 'GOSPEL',
          style: 'plain',
          fieldsOrdered: [
            { name: 'labels.$LANG', style: 'h2' },
            { name: 'variants[0].texts.$LANG.text', style: 'plain' },
          ],
        },
      ],
    };
    const langData = {
      celebrations: [
        {
          readings: [
            {
              type: 'GOSPEL',
              labels: { 'fr-FR': 'Évangile' },
              variants: [{ texts: { 'fr-FR': { text: 'Au commencement était le Verbe.' } } }],
            },
          ],
        },
      ],
    };

    const result = formatApiSectionPreview(langSection as never, langData, 'fr-FR');

    expect(result.tabs).toBeUndefined();
    expect(result.text).toContain('## Évangile');
    expect(result.text).toContain('Au commencement était le Verbe.');
  });
});

describe('repeated discriminator values in an array', () => {
  const repeatSection = {
    type: 'api',
    resultSection: 'items[]',
    discriminator: 'type',
    fields: [{ name: 'text', style: 'plain' }],
    typeStyles: { none: 'none' },
  };
  const repeatData = {
    items: [
      { type: 'lecture_2', text: 'L2 a' },
      { type: 'lecture_1', text: 'L1 a' },
      { type: 'psaume', text: 'P once' },
      { type: 'lecture_2', text: 'L2 b' },
      { type: 'lecture_1', text: 'L1 b' },
      { type: 'hidden', text: 'skip me' },
      { type: 'hidden', text: 'skip me too' },
    ],
  };

  it('creates one tab per value occurring 2+ times, in first-appearance order', () => {
    const result = formatApiSectionPreview(
      { ...repeatSection, typeStyles: { hidden: 'none' } } as never,
      repeatData,
      'es-ES',
    );

    expect(result.tabs?.map((t) => t.title)).toEqual(['lecture_2', 'lecture_1']);
    expect(result.tabs?.[0].text).toContain('L2 a');
    expect(result.tabs?.[0].text).toContain('L2 b');
    expect(result.tabs?.[1].text).toContain('L1 b');
    expect(result.tabs?.[1].text).not.toContain('L2');
  });

  it('keeps values occurring once inline, and never shows none-styled values', () => {
    const result = formatApiSectionPreview(
      { ...repeatSection, typeStyles: { hidden: 'none' } } as never,
      repeatData,
      'es-ES',
    );

    expect(result.text).toContain('P once');
    expect(result.text).not.toContain('skip me');
    expect(result.tabs?.flatMap((t) => t.text)).not.toContain('skip me');
    expect(result.tabs?.some((t) => t.text.includes('skip me'))).toBe(false);
  });

  it('does not create tabs when every value occurs once', () => {
    const result = formatApiSectionPreview(
      repeatSection as never,
      { items: [{ type: 'a', text: 'x' }, { type: 'b', text: 'y' }] },
      'es-ES',
    );

    expect(result.tabs).toBeUndefined();
    expect(result.text).toContain('x');
    expect(result.text).toContain('y');
  });
});

describe('resolveNoteLanguage', () => {
  it('uses the preferred language when all languages apply', () => {
    expect(resolveNoteLanguage('es-ES', [], 'fr-FR')).toBe('fr-FR');
    expect(resolveNoteLanguage('es-ES', undefined, 'en-US')).toBe('en-US');
  });

  it('uses the preferred language when it is applicable', () => {
    expect(resolveNoteLanguage('es-ES', ['en-US', 'fr-FR'], 'fr-FR')).toBe('fr-FR');
  });

  it('falls back to the note language and then the first applicable language', () => {
    expect(resolveNoteLanguage('es-ES', ['es-ES', 'en-US'], 'fr-FR')).toBe('es-ES');
    expect(resolveNoteLanguage('es-ES', ['en-US', 'fr-FR'], 'it-IT')).toBe('en-US');
  });
});
