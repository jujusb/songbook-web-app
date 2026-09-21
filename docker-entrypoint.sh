#!/bin/sh
set -e

if [ "$(id -u)" -eq 0 ]; then
  mkdir -p /app/content /app/music
  chown -R nextjs:nodejs /app/content /app/music
  exec setpriv --reuid=nextjs --regid=nodejs --init-groups "$@"
fi

exec "$@"