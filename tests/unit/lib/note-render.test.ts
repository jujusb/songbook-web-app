import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { getNote, saveNote, saveNoteManualPeriod } from '@/lib/content/notes';
import { renderRecurrentNoteForDate } from '@/lib/note-render';

describe('renderRecurrentNoteForDate', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;

  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  it('uses per-date manual text and keeps API sections live', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: 'Live API text' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await saveNote({
      id: 'weekly-note',
      title: 'Weekly note',
      language: 'en-US',
      recurrent_type: 'weekly',
      recurrent_schedule: 'sunday',
      periodic_behavior: 'different_per_period',
      sections: [
        { type: 'manual', id: 'intro', md: 'Base text' },
        {
          type: 'api',
          name: 'api',
          api_url: 'https://example.com/text?date=$DATE',
          discriminator: 'none',
          fields: [{ name: 'text', style: 'plain' }],
        },
      ],
      tags: [],
    });
    await saveNoteManualPeriod('weekly-note', '2026-01-04', {
      intro: { md: 'Dated manual text' },
    });

    const note = await getNote('weekly-note');
    const text = await renderRecurrentNoteForDate(note!, '2026-01-04');

    expect(text).toContain('Dated manual text');
    expect(text).toContain('Live API text');
    expect(text).not.toContain('Base text');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/text?date=2026-01-04',
      expect.anything(),
    );
  });

  it('falls back to the base manual text when the date has no saved content', async () => {
    await saveNote({
      id: 'weekly-note',
      title: 'Weekly note',
      language: 'en-US',
      recurrent_type: 'weekly',
      recurrent_schedule: 'sunday',
      periodic_behavior: 'different_per_period',
      sections: [{ type: 'manual', id: 'intro', md: 'Base text' }],
      tags: [],
    });

    const note = await getNote('weekly-note');
    expect(await renderRecurrentNoteForDate(note!, '2026-01-11')).toContain('Base text');
  });
});
