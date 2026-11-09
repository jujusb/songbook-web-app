import {
  getSetlist,
  getSetlistVersion,
  isSetlistDate,
  listSetlistVersions,
  listSetlists,
  listSongs,
  resolveSongListTitle,
  setlistContentKey,
} from '@/lib/content';
import { isSongItem, type Setlist } from '@/lib/content/schemas';

export type SetlistStatsPeriod = 'month' | 'year' | 'all';

export interface SetlistUsageRow {
  songId: string;
  title: string;
  /** Number of dated setlist events that include this song. */
  count: number;
  /** Number of distinct setlists that include this song. */
  setlistCount: number;
  /** Most recent event date. */
  lastUsed: string;
  languages: string[];
}

export interface SetlistStatsResult {
  rows: SetlistUsageRow[];
  totalEvents: number;
  totalSongs: number;
  /** Dated setlists/versions skipped because they had no usable date. */
  undatedSetlists: number;
  periodStart: string | null;
}

export interface CollectSetlistUsageOptions {
  role: 'public' | 'reviewer' | 'admin' | 'setlist_creator' | null;
  userId?: string;
  period?: SetlistStatsPeriod;
  now?: Date;
  /** Restrict aggregation to one or more setlists (by source setlist id). */
  setlistId?: string;
  setlist?: string;
  setlistIds?: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getSetlistStatsPeriodStart(
  period: SetlistStatsPeriod,
  now: Date = new Date(),
): string | null {
  if (period === 'all') return null;
  const days = period === 'month' ? 30 : 365;
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString().slice(0, 10);
}

function isWithinPeriod(date: string, start: string | null, today: string): boolean {
  if (date > today) return false;
  return !start || date >= start;
}

interface DatedSnapshot {
  date: string;
  setlist: Setlist;
}

function currentSnapshot(setlist: Setlist): DatedSnapshot[] {
  return isSetlistDate(setlist.date) ? [{ date: setlist.date, setlist }] : [];
}

/**
 * Aggregate song usage from current setlists and their dated history.
 *
 * - Admins/reviewers see all setlists; setlist creators only their own.
 * - A reference (saved shared setlist) is counted as its original setlist so
 *   the same event is never counted twice.
 * - Each song is counted at most once per dated event.
 */
export async function collectSetlistUsage(
  options: CollectSetlistUsageOptions,
): Promise<SetlistStatsResult> {
  const { role, userId, period = 'month', now = new Date() } = options;
  const requestedSetlists = new Set<string>();
  if (options.setlistId) requestedSetlists.add(options.setlistId);
  if (options.setlist) requestedSetlists.add(options.setlist);
  if (Array.isArray(options.setlistIds)) {
    for (const id of options.setlistIds) if (typeof id === 'string') requestedSetlists.add(id);
  }
  const periodStart = getSetlistStatsPeriodStart(period, now);
  const today = now.toISOString().slice(0, 10);

  const all = await listSetlists({ userId });
  const scoped = role === 'admin' || role === 'reviewer'
    ? all
    : all.filter((setlist) => !!userId && setlist.ownerId === userId);

  const songs = await listSongs({ onlyPublished: false, role: role ?? 'public' });
  const songMap = new Map(songs.map((song) => [song.id, song]));

  // Resolve references to their original setlist and de-duplicate them.
  const sources = new Map<string, Setlist>();
  for (const setlist of scoped) {
    const sourceId = setlist.sharedFrom?.setlistId ?? setlist.id;
    if (sources.has(sourceId)) continue;
    try {
      sources.set(sourceId, await getSetlist(sourceId));
    } catch {
      // A broken reference should not break the whole statistics page.
    }
  }

  const usage = new Map<string, {
    count: number;
    setlists: Set<string>;
    lastUsed: string;
    languages: Set<string>;
  }>();
  const seenSnapshots = new Set<string>();
  let totalEvents = 0;
  let undatedSetlists = 0;

  const sourcesToUse = requestedSetlists.size
    ? new Map([...sources].filter(([id]) => requestedSetlists.has(id)))
    : sources;

  for (const [sourceId, setlist] of sourcesToUse) {
    const versions = await listSetlistVersions(sourceId);
    const dated: DatedSnapshot[] = currentSnapshot(setlist);

    for (const version of versions) {
      try {
        const snapshot = await getSetlistVersion(sourceId, version.label);
        const date = isSetlistDate(snapshot.date) ? snapshot.date : version.eventDate;
        if (!date) continue;
        dated.push({ date, setlist: snapshot });
      } catch {
        // skip unreadable version
      }
    }

    if (dated.length === 0) undatedSetlists++;

    for (const snapshot of dated) {
      if (!isWithinPeriod(snapshot.date, periodStart, today)) continue;

      const fingerprint = `${sourceId}:${snapshot.date}:${setlistContentKey(snapshot.setlist)}`;
      if (seenSnapshots.has(fingerprint)) continue;
      seenSnapshots.add(fingerprint);
      totalEvents++;

      const eventSongs = new Map<string, Set<string>>();
      for (const item of snapshot.setlist.songs) {
        if (!isSongItem(item)) continue;
        const langs = eventSongs.get(item.songId) ?? new Set<string>();
        langs.add(item.lang);
        eventSongs.set(item.songId, langs);
      }

      for (const [songId, langs] of eventSongs) {
        const current = usage.get(songId) ?? {
          count: 0,
          setlists: new Set<string>(),
          lastUsed: snapshot.date,
          languages: new Set<string>(),
        };
        current.count++;
        current.setlists.add(sourceId);
        if (snapshot.date > current.lastUsed) current.lastUsed = snapshot.date;
        for (const lang of langs) current.languages.add(lang);
        usage.set(songId, current);
      }
    }
  }

  const rows: SetlistUsageRow[] = [...usage.entries()].map(([songId, value]) => {
    const languages = [...value.languages].sort();
    const song = songMap.get(songId);
    return {
      songId,
      title: song ? resolveSongListTitle(song, languages[0] ?? '') : songId,
      count: value.count,
      setlistCount: value.setlists.size,
      lastUsed: value.lastUsed,
      languages,
    };
  });

  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.lastUsed !== a.lastUsed) return b.lastUsed.localeCompare(a.lastUsed);
    return a.title.localeCompare(b.title);
  });

  return {
    rows,
    totalEvents,
    totalSongs: rows.length,
    undatedSetlists,
    periodStart,
  };
}

/** Exposed for callers that need the same rolling-day window in labels. */
export function setlistStatsPeriodDays(period: SetlistStatsPeriod): number | null {
  if (period === 'all') return null;
  return period === 'month' ? 30 : 365;
}

/** Convenience for tests and UI: the number of whole days in a period. */
export function setlistStatsPeriodMs(period: SetlistStatsPeriod): number | null {
  const days = setlistStatsPeriodDays(period);
  return days === null ? null : days * DAY_MS;
}
