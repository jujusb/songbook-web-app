import { z } from "zod";
import { canCreateSetlist } from "@/lib/auth";
import { getShareBaseUrl } from "@/lib/content";
import { getSetlistLinkAllowedHosts, getSetlistLinkAllowHttp, getSetlistMaxSongs } from "@/lib/config";
import { validateLinkUrl } from "@/lib/setlist-links";
import { SetlistItemSchema, isSongItem, isLinkItem, type SetlistItem } from "@/lib/content/schemas";

export type ParseSetlistItemsResult =
  | { items: SetlistItem[] }
  | { error: string; status?: number };

/**
 * Validate a raw `songs` payload (songs, notes and links) and enforce limits.
 * Songs count against the max-songs setting; the total number of items is
 * capped at twice that so notes/links can't be used to bloat a setlist.
 */
export async function parseSetlistItems(
  raw: unknown,
  role: string | null,
  request: Request,
): Promise<ParseSetlistItemsResult> {
  if (raw === undefined || raw === null) return { items: [] };
  if (!Array.isArray(raw)) return { error: "songs must be an array" };
  const parsed = z.array(SetlistItemSchema).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join('.')})` : '';
    return { error: `Invalid setlist item${where}: ${issue?.message ?? 'invalid'}` };
  }
  const items = parsed.data as SetlistItem[];
  const extras = items.filter((i) => !isSongItem(i));
  if (extras.length > 0) {
    if (!canCreateSetlist((role as Parameters<typeof canCreateSetlist>[0]) ?? null)) {
      return { error: "Forbidden: notes and links require a setlist creator role", status: 403 };
    }
    const links = items.filter(isLinkItem);
    if (links.length > 0) {
      const ownHosts: string[] = [];
      try { ownHosts.push(new URL(request.url).hostname); } catch {}
      const hostHeader = request.headers?.get?.('host');
      if (hostHeader) ownHosts.push(hostHeader.replace(/:\d+$/, ''));
      try {
        const base = await getShareBaseUrl();
        if (base) ownHosts.push(new URL(base).hostname);
      } catch {}
      const policy = { allowedHosts: getSetlistLinkAllowedHosts(), allowHttp: getSetlistLinkAllowHttp(), ownHosts };
      for (const l of links) {
        const check = validateLinkUrl(l.url, policy);
        if (!check.ok) return { error: `Invalid link ${l.url}: ${check.reason}` };
      }
    }
  }
  const maxSongs = getSetlistMaxSongs();
  if (items.filter(isSongItem).length > maxSongs) {
    return { error: `Maximum ${maxSongs} songs per setlist` };
  }
  if (items.length > maxSongs * 2) {
    return { error: `Maximum ${maxSongs * 2} items per setlist` };
  }
  return { items };
}
