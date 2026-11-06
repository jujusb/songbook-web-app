import { describe, it, expect } from 'vitest';
import { extractApiSectionText, formatApiSectionPreview } from '@/lib/notes';

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
