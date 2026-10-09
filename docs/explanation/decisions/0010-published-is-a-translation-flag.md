# 0010 — Published is a per-translation flag, defaulting to false

- **Status:** Accepted; visibility is not enforced uniformly
- **Date:** 2026-10-04
- **Relevant code:** `.cho` frontmatter, `src/app/songs/[songId]/page.tsx`, album/artist/browse
  listing filters

## Context

Until 2026-10-04, everything saved to `content/` was immediately public, which made the app a
surprisingly dangerous thing to point at an audience: an errant save (or a half-imported song)
showed up instantly. The publishing work in `7a748ef` / `3886cc8` / `82a107e` introduced a
`published` flag to gate what non-admins see.

## Decision

- `published` is frontmatter on **each `.cho` translation**, defaulting to `false`. A song may have
  `es` published and `en` not.
- Visibility rules: unpublished translations are hidden from non-admin browsing/listings and the
  song detail 404s for non-admins; `?all=true` on the API returns everything for admins only.
- Publishing is an explicit, admin-only step (`toggleSongPublishedAction` returns
  `Admin required` for non-admins).
- Album, artist, and browse lists filter at query time, so an unpublished song never appears in an
  aggregate either.

## Consequences

**Positive**

- Content authoring is now safe-by-default: nothing is visible until someone publishes it.
- The split per-language is honest to the data model — translation quality differs per language.

**Negative**

- A fresh ingest produces zero visible songs, and the "my songs are missing" support question is
  the direct result of this default.
- The check is **not applied uniformly.** `/compare`, `/present`, and `/music` do not re-check
  `published`, so unpublished translations remain reachable by URL on those routes even though the
  detail 404s. Anyone who directly links to them can still see them.
- Translation-level "published" means "make this visible" also controls *edit visibility*: only
  admins can even see unpublished content to edit it, because reviewers blink out of existence for
  such a song.

**Carried forward**

- Known open item: whether `/compare`/`/present`/`/music` should enforce the same gate. The ADR for
  publishing never specified the full surface; the exceptions are catalogued in
  [routes](../../reference/routes.md).

## Evidence

- `7a748ef` — publishing toggle.
- `3886cc8`, `82a107e` — published-status filtering in listings/aggregates.
- How-to: [edit and publish a song](../../how-to/edit-and-publish-a-song.md).