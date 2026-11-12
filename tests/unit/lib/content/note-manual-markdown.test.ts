import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { createTempContentDir, mockContentDir } from '../../../utils/temp-content';

describe('content/notes.ts — manual text written as markdown files', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let notes: typeof import('@/lib/content/notes');

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    notes = await import('@/lib/content/notes');
    await notes.saveNote({
      id: 'weekly-note',
      title: 'Weekly note',
      language: 'en-US',
      recurrent_type: 'weekly',
      recurrent_schedule: 'sunday',
      periodic_behavior: 'different_per_period',
      sections: [
        { type: 'manual', id: 'intro', md: 'Intro' },
        { type: 'api', name: 'weather', api_url: 'https://example.com/weather' },
      ],
      tags: [],
    } as never);
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  it('writes <date>/<lang>/<section>.md for every section and language', async () => {
    await notes.saveNoteManualPeriod('weekly-note', '2026-01-04', {
      intro: { md: 'Hello', mdByLanguage: { 'en-US': 'Hello', 'es-ES': 'Hola' } },
    });

    const base = `${tempDir.path}/data/notes/weekly-note/2026-01-04`;
    expect(await readFile(`${base}/en/intro.md`, 'utf-8')).toBe('Hello');
    expect(await readFile(`${base}/es/intro.md`, 'utf-8')).toBe('Hola');
    expect(existsSync(`${base}/fr`)).toBe(false);
    expect(existsSync(`${tempDir.path}/data/notes/weekly-note/manual`)).toBe(false);
  });

  it('falls back to the default text for the note language', async () => {
    await notes.saveNoteManualPeriod('weekly-note', '2026-01-11', {
      intro: { md: 'Only default' },
    });
    const file = `${tempDir.path}/data/notes/weekly-note/2026-01-11/en/intro.md`;
    expect(await readFile(file, 'utf-8')).toBe('Only default');
  });
});
