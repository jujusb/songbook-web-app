export type ReadOnlyOperation =
  | 'login'
  | 'logout'
  | 'register'
  | 'setlist_write'
  | 'setlist_share'
  | 'user_write'
  | 'song_write'
  | 'album_write'
  | 'artist_write'
  | 'partition_write';

export function isReadOnly(): boolean {
  return process.env.SONGBOOK_READONLY === "1";
}

export function isReadOnlyFor(operation: ReadOnlyOperation): boolean {
  if (!isReadOnly()) return false;
  // In read-only mode, allow login/logout, registration, and setlist operations for setlist_creators
  const allowedInReadOnly: ReadOnlyOperation[] = [
    'login',
    'logout',
    'register',
    'setlist_write',
    'setlist_share',
  ];
  return !allowedInReadOnly.includes(operation);
}