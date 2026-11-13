import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, cleanup, waitFor } from '../setup/test-utils';
import { SetlistEditor } from '@/components/SetlistEditor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/setlists/s1/edit',
  useSearchParams: () => new URLSearchParams(),
}));

const note = {
  id: 'sunday-note', title: 'Sunday reading', language: 'en-US', recurrent_type: 'weekly', recurrent_schedule: 'sunday',
  periodic_behavior: 'same', sections: [], api_source: 'manual', api_sources: [], created: '2026-01-01T00:00:00.000Z', tags: [],
};

describe('SetlistEditor saves note items', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return new Response('{"id":"s1"}', { status: 200, headers: { 'content-type': 'application/json' } });
      if (String(url).startsWith('/api/notes')) return new Response(JSON.stringify([note]), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('includes free notes and recurrent notes in the save request', async () => {
    renderWithProviders(
      <SetlistEditor
        availableSongs={[]}
        initialSetlist={{
          id: 's1', title: 'Sunday', description: '', image: '', date: '',
          songs: [
            { type: 'note', id: 'n1', text: 'Opening words' },
            { type: 'recurrent-note', id: 'r1', noteId: 'sunday-note', date: '2026-11-15', lang: 'en-US' },
          ] as never,
        }}
        isNew={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true));
    const put = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    const body = JSON.parse(String(put[1].body));
    expect(body.songs).toHaveLength(2);
    expect(body.songs[0]).toMatchObject({ type: 'note', text: 'Opening words' });
    expect(body.songs[1]).toMatchObject({ type: 'recurrent-note', noteId: 'sunday-note' });
  });
});
