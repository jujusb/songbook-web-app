# Deploy a production instance with Docker

The production image is a multi-stage build of a Next.js standalone server, with Chromium and the
Noto fonts installed so PDF export works. This guide covers building it, running it, and the
things you must change before exposing it to the internet.

## What the image contains

The `Dockerfile` builds on `node:20-slim` and:

- installs `chromium` and `fonts-noto`, `fonts-noto-cjk`, `fonts-noto-color-emoji` for PDF output,
- sets `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` and `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`,
- runs `npm run build`, whose `output: "standalone"` produces `.next/standalone`,
- runs as an unprivileged user (`nextjs`, uid 1001) with `HOME=/tmp` and an explicit Puppeteer
  cache dir, so Puppeteer's config loader can write its cache.

The container entrypoint `docker-entrypoint.sh` runs on start; when the container is started as
root it can fix ownership on mounted directories before dropping to `nextjs`.

## Build and run with the helper

`run.sh` is a thin wrapper around `docker compose` that sets the Compose project name and turns
`ADMIN_PASSWORD` into the seed hash:

```bash
ADMIN_PASSWORD='a-strong-password' \
JWT_SECRET='a-32-byte-random-secret' \
./run.sh up -d
```

The app is served on port 3000. Put a reverse proxy (Caddy, nginx, Traefik) in front of it for TLS.

## Build and run by hand

```bash
docker build -t songbook-web-app:latest .
docker run -d --name songbook \
  -p 3000:3000 \
  -e JWT_SECRET='a-32-byte-random-secret' \
  -e ADMIN_PASSWORD='a-strong-password' \
  -v /srv/songbook/content:/app/content \
  -v /srv/songbook/music:/app/music \
  -v /srv/songbook/partitions:/app/partitions \
  songbook-web-app:latest
```

## Before you expose it

1. **Set `JWT_SECRET`.** The default
   (`songbook-default-secret-change-me`) lets anyone who knows it forge a session cookie. Use a
   long random string and keep it out of the image.
2. **Set `ADMIN_PASSWORD`.** The default is `admin`. This password seeds the admin account the
   first time a login is attempted with no users present.
3. **Persist `content/`.** It is the database. Back it up with `rsync` or by committing it to git;
   migration to another host is a folder copy.
4. **Terminate TLS** at the proxy. Session cookies are marked `Secure` when `NODE_ENV=production`,
   which the production image sets, so the app expects HTTPS.
5. **Decide on a public instance.** For anonymous traffic, run the `songbook-public` service with
   `SONGBOOK_READONLY=1` and set `SONGBOOK_PUBLIC_URL` to its public hostname, as described in
   [Run a public read-only instance](./run-a-public-read-only-instance.md).

## Configure the app

All optional integrations are environment variables, so you can configure everything from Compose
without editing YAML: Spotify, the two Navidrome instances, OIDC, branding, and read-only mode. See
[Environment variables](../reference/environment-variables.md). `content/config/site.yaml` holds
the app title, default language, PDF page size, artist-page toggle, and the OIDC block; env vars
override it where both can express the same thing.

## Health check

The login page is a cheap liveness probe:

```bash
curl -fsS http://localhost:3000/login >/dev/null && echo up
```

## Update

```bash
docker compose build
docker compose up -d
```

Because content is a bind mount, rebuilding the image never touches your songs.

## See also

- [Run it locally](./run-it-locally.md)
- [Environment variables](../reference/environment-variables.md)
- [Run a public read-only instance](./run-a-public-read-only-instance.md)
