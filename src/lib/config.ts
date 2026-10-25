export function getSetlistMaxSongs(): number {
  const val = process.env.SETLIST_MAX_SONGS;
  if (!val) return 50;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 50 : parsed;
}

/** Hosts allowed for setlist link embeds (`SETLIST_LINK_EMBED_HOSTS`, comma-separated, `*.` wildcards). Empty = no links. */
export function getSetlistLinkAllowedHosts(): string[] {
  return (process.env.SETLIST_LINK_EMBED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether setlist links may use plain http (`SETLIST_LINK_ALLOW_HTTP=true`). Default false. */
export function getSetlistLinkAllowHttp(): boolean {
  return (process.env.SETLIST_LINK_ALLOW_HTTP ?? '').trim().toLowerCase() === 'true';
}


/**
 * Extra origins allowed in the CSP `frame-src` for built-in embeds (e.g. the public
 * Navidrome share host, which differs from the API URL). `SONGBOOK_NAVIDROME_FRAME_ORIGINS`,
 * comma-separated; bare hosts are treated as https. Does not enable setlist link creation.
 */
export function getNavidromeFrameOrigins(): string[] {
  const out = new Set<string>();
  for (const raw of (process.env.SONGBOOK_NAVIDROME_FRAME_ORIGINS ?? '').split(',')) {
    const v = raw.trim();
    if (!v) continue;
    try {
      out.add(new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).origin);
    } catch { /* skip invalid */ }
  }
  return [...out];
}
