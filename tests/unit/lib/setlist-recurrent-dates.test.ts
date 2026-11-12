import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { saveNote } from '@/lib/content/notes';
import { validateRecurrentNoteDates } from '@/lib/setlist-items';
import type { SetlistItem } from '@/lib/content/schemas';

const item = (id: string, date: string, noteId = 'sunday-note'): SetlistItem =>
  ({ type: 'recurrent-note', id, noteId, date }) as SetlistItem;

describe('validateRecurrentNoteDates', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;

  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    await saveNote({
      id: 'sunday-note',
      title: 'Sunday note',
      language: 'en-US',
      recurrent_type: 'weekly',
      recurrent_schedule: 'sunday',
      periodic_behavior: 'same',
      sections: [{ type: 'manual', id: 'intro', md: 'Text' }],
      tags: [],
    });
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it('accepts dates the note allows and rejects others', async () => {
    expect(await validateRecurrentNoteDates([item('a', '2026-11-15')])).toBeNull();
    const error = await validateRecurrentNoteDates([item('a', '2026-11-16')]);
    expect(error?.error).toContain('2026-11-16');
  });

  it('does not re-validate items that were already saved', async () => {
    const saved = [item('a', '2026-11-16')];
    expect(await validateRecurrentNoteDates(saved, saved)).toBeNull();
  });

  it('validates an item whose date was changed', async () => {
    const previous = [item('a', '2026-11-15')];
    const error = await validateRecurrentNoteDates([item('a', '2026-11-16')], previous);
    expect(error).not.toBeNull();
  });
});
