# Tutorial 1 — Your first song

In this tutorial you will start the app, log in with the admin account, read a song, and then find
that same song on disk as files. The point is to connect the thing you see in the browser to the
file-based content model everything else in the app is built on.

You need the repository checked out and Docker running. Everything here uses the development
Compose service.

## 1. Start the app

From the repository root:

```bash
docker compose up
```

The first build installs dependencies inside the image; that takes a few minutes. When it is done,
the app is at <http://localhost:3000>.

> The Compose service publishes `3000:3000` by default. If you run the app outside Docker with
> `npm run dev`, it is on the same port, so the URLs below do not change. Adjust the left-hand port
> in `docker-compose.yml` if 3000 is taken on your host.

## 2. Log in

Open the site. The header shows **Browse**, **Songs**, **Albums**, **Setlists**, and a **Login**
link on the right.

Click **Login** and sign in with the admin credentials:

- Username: `admin`
- Password: `admin` (or whatever you set `ADMIN_PASSWORD` to)

There are no users yet, so this first login creates the admin account from the seed password. See
[Authentication](../reference/authentication.md) for exactly how that works.

After logging in, the header changes: you now see a **New Song** button and, on the right, your
username with an **admin** badge.

## 3. Read a song

Click **Songs**. The repository ships two classic hymns, *Amazing Grace* and *How Great Thou Art*.

> **Why can you see them?** The seed content is **unpublished**. An anonymous visitor sees an empty
> song list, and a non-admin gets a 404 on an unpublished song. Because you are logged in as
> admin, unpublished songs are visible. This is the single most common source of "my songs are
> missing" confusion — see [Read-only mode](../reference/read-only.md) and
> [ADR-0010](../explanation/decisions/0010-published-is-a-translation-flag.md).

Click **Amazing Grace**. You get the chord sheet: chords over lyrics, with the key (`G`) shown, and
tabs at the top for the available translations (`en`, `es`). If [Spotify or Navidrome players are
configured](../how-to/enable-music-players.md) they appear here too; by default they do not.

Try the transposition control to move the key up a semitone, and notice the URL. The page is a
normal server-rendered route: `http://localhost:3100/songs/amazing-grace`.

## 4. Find it on disk

The whole song is a folder under `content/`. With the dev server running, open another terminal:

```bash
ls content/library/classic-hymns/amazing-grace
```

You will see:

```
en.cho  es.cho  meta.yaml
```

Open `meta.yaml`. It holds everything that is shared between languages — the canonical title, tags,
key, tempo, the cross-references panel, and the per-language title map:

```yaml
id: amazing-grace
title: Amazing Grace
tags: [hymn, grace, traditional]
key: G
tempo: 72
references:
  - type: bible
    label: Ephesians 2:8-9
    target: bible-kjv/ephesians-2
titles:
  en: Amazing Grace
  es: Sublime Gracia
```

Open `en.cho`. It has a YAML frontmatter block and then a ChordPro body:

```
---
language: en
translator: null
status: final
published: false
---
{title: Amazing Grace}
{key: G}

{start_of_verse: 1}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
...
```

Two things to notice:

1. The **frontmatter is per translation**, not per song. The `published: false` here is why an
   anonymous visitor cannot see this song.
2. The **body is plain ChordPro**. The app did not invent a format: you could paste this file into
   another ChordPro tool and it would understand it.

The song lives in the album folder `classic-hymns`, and `album.yaml` lists it under `songs:`.
Navigate to **Albums → Classic Hymns Collection** in the browser to see the same relationship from
the UI.

## 5. Stop and restart

Stop the server with `Ctrl+C`. Because `content/` is bind-mounted from the repository (not stored
inside the container), your files are still there. Start it again with `docker compose up`: the
songs are still present, because there is no database to be out of sync with the files.

## What you learned

- The app is a thin server over a folder of files: `content/library/<album>/<song>/`.
- A song is a folder with a shared `meta.yaml` and one ChordPro file per language.
- "Published" is a property of each translation, and the seed content starts unpublished.
- The admin account is created on first login from `ADMIN_PASSWORD`.

Next: [Tutorial 2 — Add a translation and publish it](./02-add-a-translation.md), where you will
edit the Spanish draft that is already sitting next to `en.cho` and make it visible to the public.
