/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { notesApi } from '@/lib/notes';

describe('notes save', () => {
  it('create', async () => {
    const n = await notesApi.createNote({ id: 't1', title: 'T', sections: [{ type: 'manual', md: 'hi' }], tags: [] } as any);
    console.log('created', JSON.stringify(n));
    console.log('fetch', JSON.stringify(await notesApi.fetchNote('t1')));
    expect(n.title).toBe('T');
  });
});
