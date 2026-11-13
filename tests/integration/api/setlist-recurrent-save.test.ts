import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';
import { PUT as setlistsPUT } from '@/app/api/setlists/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { createUser, createSession } from '@/lib/auth';
import { saveSetlist, getSetlist, getSetlistVersion } from '@/lib/content';
import { saveNote } from '@/lib/content/notes';

describe('PUT /api/setlists with recurrent notes', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let token: string;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    await createUser('creator', 'creatorpass', 'setlist_creator');
    token = await createSession({ id: 'creator', username: 'creator', role: 'setlist_creator' });
    vi.mocked(cookies).mockReturnValue({
      get: (name: string) => (name === 'songbook-session' ? { value: token } : undefined),
    } as never);
    await saveNote({
      id: 'sunday-note', title: 'Sunday', language: 'en-US', recurrent_type: 'weekly', recurrent_schedule: 'sunday',
      periodic_behavior: 'same', sections: [{ type: 'manual', id: 'intro', md: 'Text' }], tags: [],
    } as never);
  });
  afterEach(async () => {
    await tempDir.cleanup();
  });

  for (const mode of ['current', 'dated', 'version'] as const) {
    it(`saves a recurrent note item (${mode})`, async () => {
      const withDate = mode !== 'current';
      const date = withDate ? '2026-11-15' : undefined;
      await saveSetlist({ id: 'rn', title: 'RN', date, songs: [], ownerId: 'creator' } as never);
      const req = new Request('http://localhost/api/setlists', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'rn', title: 'RN', date, ...(mode === 'version' ? { version: '2026-11-15' } : {}),
          songs: [{ type: 'recurrent-note', id: 'r1', noteId: 'sunday-note', date: '2026-11-15', lang: 'en-US' }],
        }),
      });
      const res = await setlistsPUT(req);
      const body = await res.json();
      expect(res.status, JSON.stringify(body)).toBe(200);
      const saved = withDate ? await getSetlistVersion('rn', '2026-11-15') : await getSetlist('rn');
      if (mode === 'version') expect(body.songs ?? []).toHaveLength(1);
      expect(saved.songs).toHaveLength(1);
      expect(saved.songs[0]).toMatchObject({ type: 'recurrent-note', noteId: 'sunday-note' });
    });
  }
});
