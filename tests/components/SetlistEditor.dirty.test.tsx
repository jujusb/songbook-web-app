import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, cleanup } from '../setup/test-utils';
import { SetlistEditor } from '@/components/SetlistEditor';

const push = vi.fn();
const back = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back, refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/setlists/s1/edit',
  useSearchParams: () => new URLSearchParams(),
}));

const setlist = {
  id: 's1',
  title: 'Sunday',
  description: '',
  image: '',
  date: '2026-11-01',
  songs: [],
};

const renderEditor = (extra: Partial<Parameters<typeof SetlistEditor>[0]> = {}) =>
  renderWithProviders(
    <SetlistEditor
      availableSongs={[]}
      initialSetlist={setlist}
      isNew={false}
      versionLabel={undefined}
      datedVersions={[{ label: '2026-11-08', date: '2026-11-08' }]}
      currentDate="2026-11-01"
      {...extra}
    />,
  );

describe('SetlistEditor unsaved changes', () => {
  beforeEach(() => {
    push.mockClear();
    back.mockClear();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('navigates without asking when nothing changed', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalled();
  });

  it('asks before leaving with unsaved changes and stays when declined', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderEditor();
    fireEvent.change(screen.getByDisplayValue('Sunday'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('leaves when the user confirms discarding changes', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderEditor();
    fireEvent.change(screen.getByDisplayValue('Sunday'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(back).toHaveBeenCalled();
  });

  it('asks before opening another dated setlist from the calendar', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderEditor();
    fireEvent.change(screen.getByDisplayValue('Sunday'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: '2026-11-08' }));
    expect(confirm).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('opens an empty new-date setlist for an empty calendar day', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: '2026-11-15' }));
    expect(push).toHaveBeenCalledWith('/setlists/s1/edit?newDate=1&date=2026-11-15&empty=1');
  });
});
