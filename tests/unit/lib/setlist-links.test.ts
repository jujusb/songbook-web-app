import { describe, it, expect } from 'vitest';
import { validateLinkUrl, isHostAllowed } from '@/lib/setlist-links';

const p = { allowedHosts: ['example.org', '*.docs.com'], allowHttp: false, ownHosts: ['songbook.me'] };

describe('setlist link validation', () => {
  it('matches hosts exactly or by wildcard, case-insensitively', () => {
    expect(isHostAllowed('EXAMPLE.org', p.allowedHosts)).toBe(true);
    expect(isHostAllowed('a.docs.com', p.allowedHosts)).toBe(true);
    expect(isHostAllowed('docs.com', p.allowedHosts)).toBe(false);
    expect(isHostAllowed('example.org.evil.com', p.allowedHosts)).toBe(false);
    expect(isHostAllowed('evil-example.org', p.allowedHosts)).toBe(false);
  });
  it('accepts allowed https', () => {
    expect(validateLinkUrl('https://example.org/a', p)).toEqual({ ok: true, host: 'example.org' });
  });
  it.each([
    'http://example.org/a', 'https://u:p@example.org', 'https://evil.com', 'javascript:alert(1)',
    'https://songbook.me/x', 'not a url',
  ])('rejects %s', (u) => expect(validateLinkUrl(u, { ...p, allowedHosts: [...p.allowedHosts, 'songbook.me'] }).ok).toBe(false));
  it.each(['localhost', '127.0.0.1', '10.0.0.5', '192.168.1.1', '172.20.0.1', '169.254.1.1', '[::1]', 'printer.local'])(
    'rejects private host %s even when allowlisted', (h) => {
      expect(validateLinkUrl(`https://${h}/x`, { ...p, allowedHosts: [h.replace(/[[\]]/g, '')] }).ok).toBe(false);
    });
  it('allows http only when enabled', () => {
    expect(validateLinkUrl('http://example.org', { ...p, allowHttp: true }).ok).toBe(true);
  });
  it('empty allowlist rejects everything', () => {
    expect(validateLinkUrl('https://example.org', { ...p, allowedHosts: [] }).ok).toBe(false);
  });
});
