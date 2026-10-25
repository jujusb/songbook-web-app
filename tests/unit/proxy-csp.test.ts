import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('proxy CSP', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('sets CSP with allowlist and navidrome origin', async () => {
    vi.stubEnv('SETLIST_LINK_EMBED_HOSTS', 'docs.example.org');
    vi.stubEnv('SONGBOOK_NAVIDROME_SONGS_URL', 'http://navi.local:4533/share/x');
    const res = await proxy(new NextRequest('http://localhost/songs'));
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain('https://docs.example.org');
    expect(csp).toContain('http://navi.local:4533');
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('adds extra navidrome frame origins without duplicates', async () => {
    vi.stubEnv('SONGBOOK_NAVIDROME_SONGS_URL', 'http://navi:4533');
    vi.stubEnv('SONGBOOK_NAVIDROME_FRAME_ORIGINS', 'voces.example.com, https://voces.example.com/share/x, bad url ,http://navi:4533');
    const res = await proxy(new NextRequest('http://localhost/songs'));
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp.match(/https:\/\/voces\.example\.com/g)).toHaveLength(1);
    expect(csp.match(/http:\/\/navi:4533/g)).toHaveLength(1);
  });
});
