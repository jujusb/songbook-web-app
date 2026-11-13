import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, cleanup, waitFor } from '../setup/test-utils';
import { SetlistEditor } from '@/components/SetlistEditor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/setlists/s1/edit',
  useSearchParams: () => new URLSearchParams(),
}));

describe('SetlistEditor song language', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(init?.method === 'PUT' ? '{"id":"s1"}' : '[]', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sends the newly selected song language when saving', async () => {
    renderWithProviders(
      <SetlistEditor
        availableSongs={[{ id: 'song-a', title: 'Song A', translations: ['en-US', 'fr-FR'], titles: { 'en-US': 'Song A', 'fr-FR': 'Chant A' } }]}
        initialSetlist={{ id: 's1', title: 'Sunday', description: '', image: '', date: '', songs: [{ type: 'song', songId: 'song-a', lang: 'en-US' }] }}
        isNew={false}
      />,
    );
    const selects = screen.getAllByRole('combobox');
    const songLang = selects.find((el) => el.querySelector('option[value="fr-FR"]') && el.querySelector('option[value="en-US"]') && !el.querySelector('option[value=""]'))!;
    fireEvent.change(songLang, { target: { value: 'fr-FR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    const body = JSON.parse(String(put[1].body));
    expect(body.songs[0]).toMatchObject({ songId: 'song-a', lang: 'fr-FR' });
  });
});
