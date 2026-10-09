import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/languages/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { getLanguagesConfig } from '@/lib/content';

vi.mock('@/lib/content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/content')>();
  return {
    ...actual,
    getLanguagesConfig: vi.fn(actual.getLanguagesConfig),
  };
});

describe('API /api/languages', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;

  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns languages and default', async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.languages)).toBe(true);
    expect(typeof data.default).toBe('string');
  });

  it('reflects the LANGUAGES env var', async () => {
    vi.stubEnv('LANGUAGES', 'en,de,pt');
    const res = await GET();
    const data = await res.json();
    expect(data.languages).toEqual(['en', 'de', 'pt']);
    expect(data.default).toBe('en');
  });

  it('returns 500 when config lookup fails', async () => {
    vi.mocked(getLanguagesConfig).mockRejectedValueOnce(new Error('boom'));
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toContain('Failed to get languages');
  });
});
