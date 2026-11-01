# 0023 — Federation between songbook instances

## Status

Accepted

## Date

2026-11-01

## Context

The songbook web app is file-based, with all data stored as YAML and ChordPro files under `content/`. Each instance operates independently, and there is no built-in mechanism to share content between different songbook deployments. As more congregations, campus groups, or house churches run their own instances, there is a need to:

- Share songs, translations, and setlists between related instances
- Keep related content in sync without a central database
- Support workflows where a "parent" instance publishes content that "child" instances consume
- Enable decentralized collaboration while preserving the file-based portability guarantee

The app already supports some forms of sharing: setlists can be shared via tokens, songs can be exported/imported, and OIDC can federate authentication. However, there is no general-purpose federation layer for content itself — specifically, a **read-only public federation** mode was requested to allow instances to subscribe to content from other instances without being able to edit the original.

## Decision

We will implement a **read-only public federation** system based on the following principles:

### 1. Federation Protocol

Each songbook instance exposes a `/api/federation/public/` endpoint that supports:

- **`GET /api/federation/public/capabilities`** — Returns the instance's public federation capabilities (supported content types, languages, etc.)
- **`GET /api/federation/public/albums`** — Lists available albums (read-only, paginated)
- **`GET /api/federation/public/artists`** — Lists available artists (read-only, paginated)
- **`GET /api/federation/public/songs`** — Lists available songs with basic metadata (read-only, paginated). Supports filtering by album, artist, language, and search terms
- **`GET /api/federation/public/song?id=<song-id>`** — Gets a specific song's metadata and ChordPro content (read-only)

No POST/PUT/DELETE operations are supported on public federation endpoints (returns 403).

### 2. Configuration

Federation is enabled by setting `SONGBOOK_FEDERATION_PUBLIC=true` and configuring at least one remote peer:

```
SONGBOOK_FEDERATION_PUBLIC=true
SONGBOOK_PUBLIC_FEDERATION_PEERS=https://songbook1.example.com,https://songbook2.example.com
```

Additional config options:

| Variable | Default | Description |
|---|---|---|
| `SONGBOOK_FEDERATION_PUBLIC` | `false` | Turns the public federation API on/off |
| `SONGBOOK_PUBLIC_FEDERATION_PEERS` | `` (empty) | Comma-separated list of remote instance URLs (no protocol) |
| `SONGBOOK_FEDERATION_ENABLED` | `false` | Turns the (sync) federation API on/off — **not implemented in this ADR** |

### 3. How It Works

When `SONGBOOK_FEDERATION_PUBLIC=true` is set, the instance exposes read-only endpoints that other instances can subscribe to.

Other instances add the publisher's URL to their `SONGBOOK_PUBLIC_FEDERATION_PEERS`. Subscribed content appears in the UI as read-only — users can reference songs/albums/artists from subscribed instances when creating setlists, but cannot modify the original content.

### 4. Security and Authorization

- **Public federation endpoints are open for reading** — no authentication required for GET requests
- **POST/PUT/DELETE operations are blocked** — returns 403 Forbidden
- **Remote instance URLs are trusted only if they match the `SONGBOOK_PUBLIC_FEDERATION_PEERS` list** — no open registration of federation peers
- **Instance administrators can disable public federation at any time** by setting `SONGBOOK_FEDERATION_PUBLIC=false`; existing subscriptions are unaffected but new requests are rejected
- **Setlist link allowlists apply** — `SETLIST_LINK_EMBED_HOSTS` and `SETLIST_LINK_ALLOW_HTTP` are re-validated at render time, even for federated content

### 5. Using Subscribed Public Content

When an instance subscribes to a public federation peer:

1. Songs, albums, and artists from the remote instance appear in browsing/searching alongside local content
2. They are visually distinguished (e.g., grayed out or with a "from [instance name]" badge)
3. Users can add these items to setlists — the setlist will embed a reference to the remote content
4. When the setlist is rendered, the chords/lyrics are fetched from the original public instance at render time
5. If the remote instance removes or changes the content, the setlist may show missing/broken references (handled gracefully with fallbacks)
6. Setlists containing public-federation content can be shared publicly or privately, but the original content remains under the remote instance's control

### 5. Carried-forward Changes

The following new files and functions will be added:

- **`src/lib/federation.ts`** — Core federation logic: public federation capability discovery, content serving
- **`src/app/api/federation/public/route.ts`** — API route handlers for `/api/federation/public/capabilities`, `/api/federation/public/albums`, `/api/federation/public/artists`, `/api/federation/public/songs`, `/api/federation/public/song`
- **`src/lib/config.ts`** — New `getFederationPublicConfig()` function returning the public federation configuration
- **Environment variables** listed in section 3 above (added to `.env.example` and `docker-compose.yml`)
- **`docs/how-to/federation-between-instances.md`** — How-to guide for configuring and using public federation

### 6. Consequences

#### Positive

- Related songbook instances can share songs, albums, and artists without a central server
- Decentralized collaboration: no central server or database required; each instance is autonomous
- Privacy-preserving: user data is never synced; opt-in only for user sync (separate feature)
- Existing security models are preserved: public read-only, admin can disable
- Setlist link embed allowlists still apply to federated content

#### Negative

- Adds network dependency: public federation requires reachable remote instances
- Clock skew between instances can cause issues if sync is later enabled
- The file-based nature of the app means federation is fundamentally a read-only file-transfer operation

#### Carried forward

- All existing content schemas, revision collection, and role-based auth remain unchanged
- Setlist link embed allowlists still apply to federated content
- Read-only mode (`SONGBOOK_READONLY=1`) does not block public federation read operations
- The file-based nature of the app means federation is a read-only supplement to the file-based approach

### 7. Coordination

This ADR should be read in conjunction with:

- [0001 — Files, not a database](./0001-files-not-a-database.md) — the foundational file-based design
- [0007 — Read-only mode is a deployment profile](./0007-read-only-mode-is-a-deployment-profile.md) — public federation is separate from read-only mode
- [Environment variables](./docs/reference/environment-variables.md) — new `SONGBOOK_FEDERATION_PUBLIC` and `SONGBOOK_PUBLIC_FEDERATION_PEERS` entries
- [Setlist share by token](./0022-setlist-notes-and-links.md) — setlist links work across federation boundaries
### 5c. Notes Federation


#### 5c. Notes Federation (optional — sync of recurrent notes)

This federation mode allows instances to synchronize recurrent notes with history, enabling a "parent" instance to publish its notes and "child" instances to subscribe and keep their own history.

- **Enable notes federation**: Set `SONGBOOK_NOTES_FEDERATION=true`
- **Configure peers**: Add publisher URLs to `SONGBOOK_NOTES_FEDERATION_PEERS`
- **Sync content**: Recurrent notes (with their metadata and content sections) are synchronized between instances
- **History preservation**: Each instance keeps its own history of note versions; sync transfers the note definitions and their content, and the receiving instance maintains its own version history
- **Selective sync**: Admins can configure which note types to sync via `NOTES_API_CUSTOM_ENDPOINTS` or note tags
- **Security**: Same peer allowlist rules apply; notes are read-only for subscribers; authorship and last-modified metadata are preserved

#### Using Subscribed Notes

When an instance subscribes to a notes federation peer:

1. Notes from the publisher appear in the Notes browser alongside local notes
2. They are visually distinguished (e.g., with a "from [publisher name]" badge)
3. Users can add these notes to setlists - the note's text and metadata are fetched from the original instance at render time
4. If the publisher removes or changes a note, the subscriber's version may show missing/broken references (handled gracefully with fallbacks)
5. Setnotes containing publisher notes can be shared publicly or privately, but the original content remains under the publisher instance's control

#### Disabling notes federation

To disable notes federation, set `SONGBOOK_NOTES_FEDERATION=false`. Existing subscriptions remain in the configuration but new requests are rejected.
