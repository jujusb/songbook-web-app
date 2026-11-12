import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempContentDir, mockContentDir } from '../../../utils/temp-content';
import {
  getNote,
  getNoteManualPeriod,
  getNoteManualVersion,
  listNoteManualDates,
  listNoteManualVersions,
  restoreNoteManualVersion,
  saveNote,
  saveNoteManualPeriod,
} from '@/lib/content/notes';

describe('content/notes.ts — per-date manual history', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  async function createNote() {
    return saveNote({
      id: 'weekly-note',
      title: 'Weekly note',
      language: 'en-US',
      recurrent_type: 'weekly',
      recurrent_schedule: 'sunday',
      periodic_behavior: 'different_per_period',
      sections: [
        { type: 'manual', md: 'Base manual text' },
        { type: 'api', name: 'weather', api_url: 'https://example.com/weather' },
      ],
      tags: [],
    });
  }

  it('assigns stable ids to manual sections when saving a note', async () => {
    await createNote();
    const saved = await getNote('weekly-note');
    expect(saved?.sections[0].id).toBe('section-0');
    expect(saved?.sections[1].id).toBeUndefined();
  });

  it('keeps manual section ids unique when sections are added', async () => {
    await saveNote({
      id: 'weekly-note',
      title: 'Weekly note',
      language: 'en-US',
      recurrent_type: 'weekly',
      recurrent_schedule: 'sunday',
      periodic_behavior: 'different_per_period',
      sections: [
        { type: 'manual', id: 'section-1', md: 'First' },
        { type: 'manual', md: 'Second' },
      ],
      tags: [],
    });

    const saved = await getNote('weekly-note');
    const ids = saved?.sections.map((section) => section.id);
    expect(ids).toEqual(['section-1', 'section-1-2']);
  });

  it('stores current content per date without writing YAML history', async () => {
    await createNote();

    await saveNoteManualPeriod('weekly-note', '2026-01-04', {
      'section-0': { md: 'First Sunday text' },
    });
    await saveNoteManualPeriod('weekly-note', '2026-01-04', {
      'section-0': { md: 'Updated Sunday text' },
    });

    expect(await listNoteManualVersions('weekly-note', '2026-01-04')).toHaveLength(0);
    const current = await getNoteManualPeriod('weekly-note', '2026-01-04');
    expect(current?.sections['section-0'].md).toBe('Updated Sunday text');
  });

  it('does not duplicate identical snapshots', async () => {
    await createNote();
    const content = { 'section-0': { md: 'Same text' } };
    await saveNoteManualPeriod('weekly-note', '2026-01-04', content);
    await saveNoteManualPeriod('weekly-note', '2026-01-04', content);

    expect(await listNoteManualVersions('weekly-note', '2026-01-04')).toHaveLength(0);
  });

  it('keeps dates and language variants separate', async () => {
    await createNote();
    await saveNoteManualPeriod('weekly-note', '2026-01-04', {
      'section-0': { md: 'English', mdByLanguage: { 'en-US': 'English', 'es-ES': 'Español' } },
    });
    await saveNoteManualPeriod('weekly-note', '2026-01-11', {
      'section-0': { md: 'Next week' },
    });

    expect(await listNoteManualDates('weekly-note')).toEqual(['2026-01-11', '2026-01-04']);
    const period = await getNoteManualPeriod('weekly-note', '2026-01-04');
    expect(period?.sections['section-0'].mdByLanguage?.['es-ES']).toBe('Español');
  });

  it('restores a legacy version as the current content', async () => {
    await createNote();
    await saveNoteManualPeriod('weekly-note', '2026-01-04', {
      'section-0': { md: 'Second' },
    });
    await expect(
      restoreNoteManualVersion('weekly-note', '2026-01-04', 'missing-label'),
    ).rejects.toThrow('Version not found');
    const current = await getNoteManualPeriod('weekly-note', '2026-01-04');
    expect(current?.sections['section-0'].md).toBe('Second');
  });

  it('rejects invalid dates and missing notes', async () => {
    await createNote();
    await expect(
      saveNoteManualPeriod('weekly-note', '../escape', { 'section-0': { md: 'x' } }),
    ).rejects.toThrow('Invalid date');
    expect(await getNoteManualPeriod('weekly-note', 'not-a-date')).toBeNull();

    await expect(
      saveNoteManualPeriod('missing-note', '2026-01-04', { 'section-0': { md: 'x' } }),
    ).rejects.toThrow('Note not found');
  });
});
