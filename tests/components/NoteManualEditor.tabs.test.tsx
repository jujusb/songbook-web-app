import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, cleanup, waitFor } from '../setup/test-utils';
import { NoteManualEditor } from '@/components/NoteManualEditor';
import type { NoteMetadata } from '@/lib/notes';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

function makeNote(languages: string[]): NoteMetadata {
  return {
    id: 'n1',
    title: 'Note',
    language: languages[0],
    recurrent_type: 'daily',
    recurrent_schedule: '',
    periodic_behavior: 'different_per_period',
    sections: [
      { type: 'manual', id: 'intro', periodic_behavior: 'same', md: 'Fixed EN', mdByLanguage: { 'en-US': 'Fixed EN', 'fr-FR': 'Fixe FR' } } as NoteMetadata['sections'][number],
      { type: 'manual', id: 'daily', md: '', periodic_behavior: 'different_per_period' },
    ],
    api_source: 'manual',
    api_sources: [],
    created: '2026-01-01T00:00:00.000Z',
    tags: [],
  } as unknown as NoteMetadata;
}

describe('NoteManualEditor language tabs', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && String(url).includes('/preview/')) return json({ text: 'API text' });
      if (init?.method === 'POST') return json({ ok: true });
      return json({ content: null, versions: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows one tab per language and switches the editable text', async () => {
    renderWithProviders(<NoteManualEditor noteId="n1" note={makeNote(['en-US', 'fr-FR'])} languages={['en-US', 'fr-FR']} initialDate="2026-11-15" />);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Fixed EN')).toBeInTheDocument();
    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Fixe FR')).toBeInTheDocument();
    expect(screen.queryByText('Fixed EN')).not.toBeInTheDocument();
  });

  it('keeps unsaved text when switching language', async () => {
    renderWithProviders(<NoteManualEditor noteId="n1" note={makeNote(['en-US', 'fr-FR'])} languages={['en-US', 'fr-FR']} initialDate="2026-11-15" />);
    const [en, fr] = await screen.findAllByRole('tab');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft EN' } });
    fireEvent.click(fr);
    fireEvent.click(en);
    expect(screen.getByRole('textbox')).toHaveValue('Draft EN');
  });

  it('saves the drafts of every language', async () => {
    renderWithProviders(<NoteManualEditor noteId="n1" note={makeNote(['en-US', 'fr-FR'])} languages={['en-US', 'fr-FR']} initialDate="2026-11-15" />);
    const [, fr] = await screen.findAllByRole('tab');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft EN' } });
    fireEvent.click(fr);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Brouillon FR' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST' && !String(init?.body).includes('"lang"'));
      expect(post).toBeDefined();
      const body = JSON.parse(String(post![1]!.body));
      expect(body.sections.daily.mdByLanguage).toEqual({ 'en-US': 'Draft EN', 'fr-FR': 'Brouillon FR' });
    });
  });

  it('hides the tab bar for a single-language note', async () => {
    renderWithProviders(<NoteManualEditor noteId="n1" note={makeNote(['en-US'])} languages={['en-US']} initialDate="2026-11-15" />);
    await screen.findByRole('textbox');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
