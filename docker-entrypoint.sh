#!/bin/sh
set -e

if [ "$(id -u)" -eq 0 ]; then
  if [ "$SONGBOOK_READONLY" != "1" ]; then
    mkdir -p /app/content /app/music /app/revisions
    chown -R nextjs:nodejs /app/content /app/music
    # The revision tree is a volume of its own. Without this the app user
    # cannot write snapshots and every song save fails with EACCES.
    chown -R nextjs:nodejs /app/revisions ||
      echo "warning: /app/revisions is not writable by the app user"
  fi
  exec setpriv --reuid=nextjs --regid=nodejs --init-groups "$@"
fi

exec "$@"