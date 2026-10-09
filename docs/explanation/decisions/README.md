# Architecture decision records

Fifteen decisions that explain why the app looks the way it does. Each is written from the
repository's own history: the commits are real, the dates are real, and where a decision was later
partly undone — or never aligned with the plan — the ADR says so.

## Reading them

Each record has:

- **Status** — Accepted, with a caveat, or accepted with an unresolved sharp edge.
- **Date** — when the decision was made, and where it took more than one commit to land.
- **Context** — the situation that made a decision necessary.
- **Decision** — what was chosen, and where to read it in the code today.
- **Consequences** — what it cost. Positive, negative, and carried forward.
- **Evidence** — the commits, so you can check them (`git show <hash>` works).

## Index

| # | Decision | Status | Date |
| --- | --- | --- | --- |
| [0001](./0001-files-not-a-database.md) | The data is files, not a database | Accepted | 2026-07-08 |
| [0002](./0002-chordpro-and-one-folder-per-song.md) | Songs are ChordPro folders, parsed by two renderers | Accepted; two parsers must not drift | 2026-07-08 → 2026-09-19 |
| [0003](./0003-custom-jwt-authentication.md) | Authentication is hand-rolled JWT over YAML files | Accepted | 2026-07-08 |
| [0004](./0004-oidc-is-additive.md) | OIDC is an environment-enabled layer, not a replacement | Accepted | 2026-07-08 → 2026-10-09 |
| [0005](./0005-authorization-per-route.md) | Authorization is per route, with no middleware | Accepted; the checks can be skipped | 2026-07-08 → present |
| [0006](./0006-four-roles-and-granular-permissions.md) | Four roles; reviewer permissions are UI affordances | Accepted; permissions are not enforced | 2026-07-08 → 2026-10-05 |
| [0007](./0007-read-only-mode-is-a-deployment-profile.md) | Read-only mode keeps setlists and registration on | Accepted | 2026-09-21 → 2026-10-05 |
| [0008](./0008-setlists-share-by-token.md) | Setlists share by token or slug, never by account | Accepted | 2026-07-08 → 2026-09-24 |
| [0009](./0009-revisions-are-snapshots.md) | Revisions are timestamped file copies | Accepted | 2026-10-05 |
| [0010](./0010-published-is-a-translation-flag.md) | Published is a per-translation flag, default false | Accepted; visibility not enforced uniformly | 2026-10-04 |
| [0011](./0011-two-navidrome-instances.md) | Two Navidrome servers: originals and per-voice | Accepted; matching is text-based | 2026-09-24 |
| [0012](./0012-languages-come-from-configuration.md) | Languages come from configuration, not `languages.yaml` | Accepted; **reverses** the plan | 2026-09-24 → 2026-10-04 |
| [0013](./0013-pdf-from-our-own-print-route.md) | PDFs are printed by Chromium from the app's own route | Accepted; Chromium in the image | 2026-09-21 → 2026-09-24 |
| [0014](./0014-the-music-importer-was-removed.md) | The music importer was built, then removed | Superseded; **feature removed** | 2026-07-27 → 2026-09-24 |
| [0015](./0015-tests-arrive-late.md) | Tests arrive late, and only cover what they cover | Accepted; the early decisions are unpinned | 2026-10-09 |

## The decisions that were reversed or never landed

These are visible in the history only because they were adopted and then taken back, or written into
the plan and never built:

| Attempt | Commits | What happened |
| --- | --- | --- |
| `content/config/languages.yaml` as the language source | `1ed8912` → `0a7abad` | Added with the first commit, deleted when languages moved to env. See [ADR-0012](./0012-languages-come-from-configuration.md). |
| Music importer (scan `MUSIC_DIR` for audio files and link them to songs) | `b80ff6e`, `4dd5e54` → `58f14d6` | The module, its route, and its translations were removed in one commit. See [ADR-0014](./0014-the-music-importer-was-removed.md). |
| Dual-window projection via BroadcastChannel | specified in `songbook-web-app.md` | Never built. The projection view is one window; `?display=audience` is a second window on the same URL. |
| Git-commit-on-save as a content safety net | proposed in `songbook-web-app.md` §4.1 | Never built. Versioning is manual. See [ADR-0009](./0009-revisions-are-snapshots.md). |
| New translations scaffold with the source section structure | specified in `songbook-web-app.md` §4.3 | Never built. `addSongTranslation` scaffolds an empty `{title}` body. |
| `content/songs/` flat layout | `songbook-web-app.md` §3 | Superseded by `content/library/<album>/<song>`. |

## Known open items

Things the project has not settled, collected so they are not mistaken for decided:

1. **Whether unprefixed API authorization is intended.** `POST /api/songs`, `PUT/DELETE
   /api/albums`, and the artist mutations check only read-only mode. There is no commit that
   explains whether this is deliberate. See [ADR-0005](./0005-authorization-per-route.md).
2. **Whether reviewer permissions are meant to be a boundary.** `canEdit` ignores them and the
   write actions do not check them. See [ADR-0006](./0006-four-roles-and-granular-permissions.md).
3. **Whether an unpublished translation should 404 on `/compare` and `/present`.** The reader 404s;
   the other routes do not. See [ADR-0010](./0010-published-is-a-translation-flag.md).
4. **Whether `languages.yaml` may be resurrected from documentation.** It appears in the README and
   `AGENTS.md` but is not read. See [ADR-0012](./0012-languages-come-from-configuration.md).
5. **Roles staleness for OIDC users.** The role is resolved once and written; no commit addresses
   provider-side role changes. See [ADR-0004](./0004-oidc-is-additive.md).

## Status vocabulary

| Status | Meaning |
| --- | --- |
| Accepted | In force, no known intent to change |
| Accepted, with a caveat | In force, with a documented sharp edge |
| Accepted; X unresolved | In force, with a named question left open |
| Superseded | A later decision or commit replaced it |