#!/bin/sh
set -e

if [ "$(id -u)" -eq 0 ]; then
  if [ "$SONGBOOK_READONLY" != "1" ]; then
    mkdir -p /app/data
    chown -R nextjs:nodejs /app/data
  fi
  exec setpriv --reuid=nextjs --regid=nodejs --init-groups "$@"
fi

exec "$@"