# Architecture

This page explains the layers of the app and the path a request takes. It is about *why* the parts
are arranged the way they are; the [reference](../reference/README.md) tells you what each part
accepts.

## The core bet: files, not a database

The whole app is organized around one decision: **every piece of data is a text file under
`content/`**, and the server is a thin layer over that folder. No database, no ORM, no migration
script. See [ADR-0001](./decisions/0001-files-not-a-database.md).

What that buys: the data is diffable and portable, backup is `rsync` or `git`, and a librarian can
edit a song with any text editor while the server runs. What it costs: reads are filesystem scans
rather than indexed queries, concurrency is naive (last writer wins), and nothing prevents two
containers from editing the same file — the [deployment guide](../how-to/deploy-with-docker.md)
assumes one writer.

## The layers

```
Browser
  │ pages (server components, src/app) — read content, call auth helpers, render
  │ server actions (src/app/actions.ts) — mutations with revalidation
  │ API routes (src/app/api) — JSON interface, used by tooling and some clients
  ▼
┌─────────────┬──────────────┬──────────────┐
│ content     │ auth         │ integrations │
│ src/lib/    │ src/lib/auth │ src/lib/     │
│   content/  │              │ chordpro,    │
│             │              │ navidrome,   │
│             │              │ spotify, pdf │
└──────┬──────┴──────────────┴──────────────┘
       ▼
   content/   (the database, as files)
```

- **Pages** are server components by default. They call content/auth functions directly and render.
  There is no data-fetching layer — Next.js is the data-fetching layer.
- **Mutations** go through server actions (`src/app/actions.ts`) or through `/api` routes. Both
  write files via `src/lib/content` and then `revalidatePath` the affected routes. The two paths
  are not always in step (see [Server actions](../reference/server-actions.md) and
  [API endpoints](../reference/api-endpoints.md)), which is a known wart.
- **Auth** is checked per route with `getSession()`/`canEdit`/`canAdmin`; there is no middleware,
  and `src/middleware.ts` only manages the UI-locale cookie. See
  [ADR-0005](./decisions/0005-authorization-per-route.md).
- **Integrations** (`chordpro`, `navidrome`, `spotify`, `pdf`, `i18n`) are libraries over the
  content types. They never write content themselves, with the exception of voice-share generation,
  which writes `voiceShares` back to setlists.

## The request path, one example

`GET /songs/amazing-grace?lang=es`:

1. `SongPage` (`src/app/songs/[songId]/page.tsx`) runs `getSong`, `getSongTranslations`,
   `getSession`, `getLanguagesConfig`, `getSongTranslation`.
2. It checks the selected translation's `published` flag against the session role (admin sees
   everything).
3. `<ChordSheet>` (client component) renders the ChordPro body: chords over lyrics, section labels,
   a transposition control.
4. `LanguageSwitcher` offers the other translations; each is just a different query param and file.

No API call happens for the page itself; the server component assembled the HTML. Client components
only fetch when a live action needs it (e.g. `<UserMenu>` re-fetches `/api/auth/me` on route
change).

## Two languages in one app

There are two unrelated "languages" systems, and confusing them causes real bugs:

- **Song translations** — the `.cho` files. One per song per language, chosen with `?lang=`. Stored
  in content. Governed by `published`, the default language, and `LANGUAGES`/`LANGUAGES_DEFAULT`.
- **UI language** — the interface strings (buttons, menus). Translated EN/ES/FR in
  `src/lib/i18n/locales/`. Stored in a cookie (`songbook-ui-locale`) and chosen by
  `<LocaleSwitcher>`, propagated by `src/middleware.ts`.

The default *song* language is used for Spotify-original logic and metadata fallbacks. The *UI*
language is cosmetic. Neither knows about the other. See
[ADR-0012](./decisions/0012-languages-come-from-configuration.md).

## Rendering and PDF

Server rendering matters in two places:

- The **projection view** and **print routes** are server-rendered so they are reproducible
  headlessly.
- The **PDF exporter** does not draw files with a PDF library. It loads the app's own print route in
  Puppeteer and calls `page.pdf()`, so the PDF matches the HTML exactly. That is why the image ships
  Chromium and fonts. See [ADR-0013](./decisions/0013-pdf-from-our-own-print-route.md).

## The editor's own data path

The CodeMirror editor is a client component that talks to `saveSongAction`. The action preserves
the frontmatter, writes the file, and revalidates. Because content is plain files, "autosave" is a
file write, and the revision history is a folder of timestamped copies next to the live file — see
[ADR-0009](./decisions/0009-revisions-are-snapshots.md).

## What is not here

- **No search server.** Listing filters in memory. Fine for hundreds to low thousands of songs.
- **No queue.** File writes are synchronous and unbatched.
- **No background worker.** Voice shares are generated on request.
- **No database** of any kind, including SQLite.
- **No auth middleware**, as noted above.

## See also

- [ADR-0001 — Files, not a database](./decisions/0001-files-not-a-database.md)
- [Content model](./content-model.md)
- [Reference](../reference/README.md)