#!/bin/sh
set -e

if [ "$(id -u)" -eq 0 ]; then
  if [ "$SONGBOOK_READONLY" != "1" ]; then
    mkdir -p /app/content /app/music
    chown -R nextjs:nodejs /app/content /app/music
  fi
  exec setpriv --reuid=nextjs --regid=nodejs --init-groups "$@"
fi

exec "$@"