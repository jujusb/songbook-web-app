# Songbook Web App documentation

A self-hosted, file-based songbook. Songs are written in [ChordPro](https://www.chordpro.org/),
stored as human-readable YAML and `.cho` files under `content/`, and served by a Next.js app that
renders chords over lyrics, projects songs live, exports PDFs, and organises songs into shareable
setlists.

There is no database. Every song, album, artist, setlist and user is a file you can open, diff,
commit to git, `rsync` to another host, or edit with a text editor while the server is running.
The only external services the app can talk to are optional: an OIDC provider, Spotify, and one or
two Navidrome servers. None of them are required.

## Run it

The supported path is Docker Compose:

```bash
git clone https://github.com/anomalyco/songbook-web-app
cd songbook-web-app
docker compose up
```

The development instance is then at <http://localhost:3000>. On the first login, an admin account
is created from `ADMIN_PASSWORD` (default `admin` / `admin`).

For production, the `run.sh` wrapper builds the standalone image and sets the environment:

```bash
ADMIN_PASSWORD=your-password JWT_SECRET=your-secret ./run.sh up -d
```

See [Running it locally](./how-to/run-it-locally.md) for the full picture, including the host
prerequisites and the development/production split.

## How this documentation is organised

The documentation follows the [Diátaxis](https://diataxis.fr) method. The four sections answer four
different questions, and each one is written so it can be read on its own:

| Section | Question it answers | Start here |
| --- | --- | --- |
| [Tutorials](./tutorials/) | *I am new here. Walk me through something that works.* | [Your first song](./tutorials/01-first-song.md) |
| [How-to guides](./how-to/) | *I know the app. Do this specific task for me.* | [Run it locally](./how-to/run-it-locally.md) |
| [Reference](./reference/) | *What exactly does this file, route or variable accept?* | [Content model](./reference/content-model.md) |
| [Explanation](./explanation/) | *Why is it built this way? What were the trade-offs?* | [Decisions](./explanation/decisions/README.md) |

Do not read them in order. Pick the question you have.

## The 30 second mental model

```
content/                              the database, as files
  config/site.yaml                    title, default language, OIDC, PDF page size
  config/voices.json                  optional per-language VOICES matching vocabulary (see how-to)
  artists/<artist-id>.yaml            artist bio, website, tags
  library/<album-id>/
    album.yaml                        album metadata, track order, Spotify/YouTube
    <song-id>/
      meta.yaml                       shared song metadata: titles, key, tags, references, partitions
      <lang>.cho                      one file per language; ChordPro body + YAML frontmatter
      .revisions/<lang>/<ts>.cho      timestamped snapshots
  setlists/<setlist-id>.yaml          ordered songs, owner, share token/slug, voice shares
  users/<user-id>.yaml                bcrypt hash, role, permissions, auth provider

src/app/                              Next.js App Router: pages + API routes + server actions
src/lib/content/                      file-based CRUD + Zod schemas
src/lib/auth/                         JWT sessions, users, RBAC, OIDC
src/lib/chordpro/                     ChordSheetJS wrappers and text import
src/lib/navidrome/                    Subsonic client and voice-share generation
src/lib/pdf/                          Puppeteer PDF generation
```

Vocabulary you will meet everywhere:

- **Library** — the tree of albums and songs under `content/library/`. A song that belongs to no
  album lives under the reserved album id `no-album`.
- **Song** — a folder with a shared `meta.yaml` and one ChordPro file per language. The *song id*
  is the folder name.
- **Translation** — a single `<lang>.cho` file for a song. It has its own frontmatter (language,
  translator, status) and its own `published` flag.
- **Revision** — a timestamped snapshot of one translation, written to `.revisions/` before an
  edit that comes through the editor or the revision API.
- **Setlist** — an ordered list of songs, each pinned to a language, with an owner. Shareable
  through a public flag, a random token, or a custom slug.
- **Role** — one of `public`, `setlist_creator`, `reviewer`, `admin`. Auth is checked per route;
  there is no middleware guarding pages.
- **Read-only mode** — `SONGBOOK_READONLY=1` turns a write-capable instance into a public one that
  still allows login, self-registration, and setlist creation/sharing, but blocks everything else.

## Documentation and the code

Unlike some projects, the reference in this folder is **not** generated. The app has no JSDoc
extraction step, so every reference page is hand-written and kept honest by review. Where a page
describes an API route, a server action or a content schema, the file path is given so you can read
the source alongside it.

The [explanation](./explanation/README.md) section is sourced from the repository's own history:
each decision cites the commits that made it, and decisions that were later reversed say so.
