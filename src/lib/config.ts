export function getSetlistMaxSongs(): number {
  const val = process.env.SETLIST_MAX_SONGS;
  if (!val) return 50;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 50 : parsed;
}