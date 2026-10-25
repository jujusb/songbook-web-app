/**
 * Validation of setlist link URLs (pure, usable on server and client).
 * Links are embedded only when their host is on the allowlist.
 */

export interface LinkPolicy {
  allowedHosts: string[];
  allowHttp: boolean;
  /** Hostnames of the songbook itself (never embeddable). */
  ownHosts?: string[];
}

export type LinkCheck = { ok: true; host: string } | { ok: false; reason: string };

function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (h.includes(':')) {
    return h === '::' || h === '::1' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:');
  }
  return false;
}

export function safeHost(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

export function isHostAllowed(host: string, allowedHosts: string[]): boolean {
  const h = host.toLowerCase();
  return allowedHosts.some((raw) => {
    const p = raw.trim().toLowerCase();
    if (!p) return false;
    if (p.startsWith('*.')) return h.endsWith(p.slice(1)) && h.length > p.length - 1;
    return h === p;
  });
}

export function validateLinkUrl(url: string, policy: LinkPolicy): LinkCheck {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: 'invalid URL' };
  }
  if (u.protocol !== 'https:' && !(policy.allowHttp && u.protocol === 'http:')) {
    return { ok: false, reason: policy.allowHttp ? 'only http(s) links are allowed' : 'only https links are allowed' };
  }
  if (u.username || u.password) return { ok: false, reason: 'URLs with credentials are not allowed' };
  const host = u.hostname.toLowerCase();
  if (isPrivateHost(host)) return { ok: false, reason: 'private or local hosts are not allowed' };
  if ((policy.ownHosts ?? []).some((o) => o.toLowerCase() === host)) {
    return { ok: false, reason: 'links to this site are not allowed' };
  }
  if (!isHostAllowed(host, policy.allowedHosts)) {
    return {
      ok: false,
      reason: policy.allowedHosts.length
        ? `host not allowed (allowed: ${policy.allowedHosts.join(', ')})`
        : 'no hosts are allowed for links',
    };
  }
  return { ok: true, host };
}
