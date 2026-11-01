import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempContentDir, mockContentDir } from '../../../utils/temp-content';
import { cookies } from 'next/headers';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Server Actions — auto speed preferences', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let actions: typeof import('@/app/actions');

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    actions = await import('@/app/actions');
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  async function loginAsSinger() {
    const { createUser, createSession } = await import('@/lib/auth');
    await createUser('singer', 'singerpass', 'public');
    const token = await createSession({ id: 'singer', username: 'singer', role: 'public' });
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name) =>
        name === 'songbook-session' ? (token ? { value: token } : undefined) : undefined
      ),
    } as never);
  }

  it('saves both auto speeds to the user profile', async () => {
    await loginAsSinger();

    await expect(actions.updateMyAutoAdvanceSpeedAction(20)).resolves.toEqual({ ok: true });
    await expect(actions.updateMyAutoScrollSpeedAction(2)).resolves.toEqual({ ok: true });

    const { getUser } = await import('@/lib/auth');
    const user = await getUser('singer');
    expect(user?.autoAdvanceSeconds).toBe(20);
    expect(user?.autoScrollSpeed).toBe(2);
  });

  it('accepts the x0.5 auto-scroll speed', async () => {
    await loginAsSinger();

    await expect(actions.updateMyAutoScrollSpeedAction(0.5)).resolves.toEqual({ ok: true });

    const { getUser } = await import('@/lib/auth');
    const user = await getUser('singer');
    expect(user?.autoScrollSpeed).toBe(0.5);
  });

  it('rejects speeds outside the allowed range', async () => {
    await loginAsSinger();

    const advance = await actions.updateMyAutoAdvanceSpeedAction(999);
    expect(advance.ok).toBe(false);

    const scroll = await actions.updateMyAutoScrollSpeedAction(4);
    expect(scroll.ok).toBe(false);

    const fractional = await actions.updateMyAutoScrollSpeedAction(1.5);
    expect(fractional.ok).toBe(false);
  });

  it('requires an authenticated user', async () => {
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn(() => undefined),
    } as never);

    const advance = await actions.updateMyAutoAdvanceSpeedAction(20);
    expect(advance.ok).toBe(false);

    const scroll = await actions.updateMyAutoScrollSpeedAction(2);
    expect(scroll.ok).toBe(false);
  });
});
