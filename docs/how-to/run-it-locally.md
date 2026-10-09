# Run it locally

There are two ways to run the app on your own machine: the supported Docker Compose path, and a
plain Node dev server. Docker is the supported one; the Node path is convenient when you are
editing the source.

## Prerequisites

- **Docker with Compose** — for the supported path.
- **Node 20 or newer** — only for the plain Node path. Next.js 16 does not run on Node 18.
- A checkout of the repository.

## Run with Docker Compose (recommended)

```bash
docker compose up
```

This builds the development image and starts the `songbook` service. The app is at
<http://localhost:3000>. The first build downloads dependencies and takes a few minutes; later
starts are fast.

The Compose file mounts your working tree into the container and reads configuration from `.env`
in the repository root. Notable mounts:

| Host | Container | Purpose |
| --- | --- | --- |
| `SONGBOOK_CONTENT_DIR` (default `./content`) | `/app/content` | songs, albums, setlists, users |
| `SONGBOOK_MUSIC_DIR` (default `/music`) | `/app/music` | audio files served by `/api/music/...` |
| `SONGBOOK_PARTITION_DIR` (default `./data`) | `/app/partitions` | sheet-music PDFs |

Because `content/` is bind-mounted, every edit you make in the UI is immediately visible on the
host, and every file you drop in `content/` shows up in the app. There is no database.

Set the admin password and JWT secret in `.env` before you start, or accept the defaults:

```bash
# .env
SONGBOOK_ADMIN_PASSWORD=change-me
JWT_SECRET=a-long-random-string
```

### The public instance

`docker compose up` also starts a second service, `songbook-public`, on
<http://localhost:9000> (or `SONGBOOK_PUBLIC_PORT`). It runs with `SONGBOOK_READONLY=1` and mounts
the content read-only, so it can serve public traffic without exposing write endpoints. See
[Run a public read-only instance](./run-a-public-read-only-instance.md). If you do not want it, run
just the first service:

```bash
docker compose up songbook
```

## Run with a plain Node dev server

```bash
npm install
npm run dev
```

The dev server is at <http://localhost:3000> as well. The app reads content from `<cwd>/content`
with no env override, so run it from a directory that has a `content/` folder (the repository root,
by default):

```bash
npm run dev
```

If your songs live somewhere else, symlink them in from the repository root:

```bash
ln -s /absolute/path/to/content ./content
npm run dev
```

The `SONGBOOK_CONTENT_DIR` variable in `.env.example` is a **Compose-only** variable that selects
the host folder to bind-mount; the app itself never reads it.

> **Do not mix the two.** The development Compose service keeps its own `node_modules` inside the
> container. If you run `npm install` on the host and also use the container, you maintain two
> dependency trees. Pick one.

## Useful environment variables

| Variable | Default | Effect |
| --- | --- | --- |
| `SONGBOOK_CONTENT_DIR` | `./content` | where the content tree lives |
| `SONGBOOK_MUSIC_DIR` | `./music` | where audio files live |
| `SONGBOOK_PARTITION_DIR` | `./data` | where sheet-music PDFs live |
| `SONGBOOK_ADMIN_PASSWORD` | `admin` | password of the auto-created admin |
| `JWT_SECRET` | `songbook-default-secret-change-me` | cookie signing key |
| `LANGUAGES` | `en,es,fr` (from Compose) | enabled language codes |
| `LANGUAGES_DEFAULT` | `es` (from Compose) | default language |

`LANGUAGES` and `LANGUAGES_DEFAULT` are what the app reads; in Compose they are populated from
`SONGBOOK_LANGUAGES` and `SONGBOOK_LANGUAGES_DEFAULT` so you only edit one pair. See
[Environment variables](../reference/environment-variables.md) for the full list.

## Verify it is up

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/login
# 200
```

Then open the site and log in as `admin` with your `SONGBOOK_ADMIN_PASSWORD` (default `admin`). The
first login creates the account. See [Your first song](../tutorials/01-first-song.md).

## Stop and clean up

```bash
docker compose down          # stop, keep content
docker compose down -v       # also remove named volumes (dev node_modules)
```

Your `content/` folder is on the host, not in a volume, so it survives `down -v`.
