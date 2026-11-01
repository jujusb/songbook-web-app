# Federation between songbook instances — Read-only Public Federation

/***
This guide describes the **read-only public federation** mode, which allows one songbook instance to publish its content for other instances to subscribe to and use, without being able to edit the original content.

## Overview

Federation is **opt-in** and **peer-to-peer**. There is no central server — each instance is autonomous. The public federation mode enables a "parent" instance to publish content that "child" instances can consume read-only.

## Enabling Public Federation

Add the following environment variables to your `.env` or `docker-compose.yml`:

```env
# Enable public federation (read-only)
SONGBOOK_FEDERATION_PUBLIC=true

# Comma-separated list of publisher instance URLs (no protocol, e.g. "example.com")
# Other instances will subscribe to these publishers
SONGBOOK_PUBLIC_FEDERATION_PEERS=https://publisher-songbook.example.com
```

## Configuration

### On the Publisher Instance

1. Set `SONGBOOK_FEDERATION_PUBLIC=true`
2. Optionally configure `SONGBOOK_PUBLIC_FEDERATION_PEERS` if you want to pre-subscribe to other instances (not typically needed for publishers)
3. The instance will expose read-only API endpoints at `/api/federation/public/`

### On Subscriber Instances

1. Set `SONGBOOK_FEDERATION_PUBLIC=true` (enables the feature to discover public federated content)
2. Add the publisher's URL to `SONGBOOK_PUBLIC_FEDERATION_PEERS`:
   ```env
   SONGBOOK_PUBLIC_FEDERATION_PEERS=https://publisher-songbook.example.com
   ```
3. The subscriber instance will now see the publisher's content in browsing and searching



## Recurrent Notes via Public Federation

The public federation API endpoints also support recurrent notes, allowing publishers to share their recurrent notes with subscribers.

**API Endpoints for Recurrent Notes:**

- **`GET /api/federation/public/notes`** — Lists all recurrent notes published by the instance
  - Supports filtering by `periodic_behavior`, `languages`, `recurrent_type`
  - Returns note metadata including `name`, `period`, `languages`, and section information

- **`GET /api/federation/public/note?id=<note-id>`** — Gets a specific recurrent note's metadata and content
  - Returns the note's `meta.yaml` fields and the structured JSON `content` array
  - The content sections may include both manual (`md`) and API-fetched sections
  - The note's `periodic_behavior` field indicates whether the text is `"same"` or `"different_per_period"`

- **`GET /api/federation/public/notes/search`** — Searches recurrent notes
  - Query parameters: `q` (full-text search), `recurrent_type`, `languages`, `periodic_behavior`
  - Returns matching notes with metadata and preview snippets

**Using Recurrent Notes in Subscribed Instances:**

When a subscriber instance adds the publisher to `SONGBOOK_PUBLIC_FEDERATION_PEERS`:

1. Recurrent notes from the publisher appear in the Notes browser alongside local notes
2. Notes are visually distinguished with a "from [publisher name]" badge
3. The note's `periodic_behavior` is respected:
   - `"same"`: The note's text is the same for all periods/occurrences
   - `"different_per_period"`: The note has per-period text; the subscriber can select which period's version to use
4. Notes can be added to setlists, with a date selector to choose which period's version
5. The note's content is fetched from the original publisher instance at render time

**Example: Subscribing to Recurrent Gospel Notes**

1. Publisher sets `SONGBOOK_FEDERATION_PUBLIC=true` and publishes gospel notes
2. Subscriber adds publisher URL to `SONGBOOK_PUBLIC_FEDERATION_PEERS`
3. The subscriber's Notes browser shows the publisher's gospel notes with a "from Congregation A" badge
4. The subscriber can:
   - View the note's metadata (periodic type, languages, last fetched date)
   - Add the note to a setlist, selecting which week's version
   - Search for notes by title, language, or recurrent type
5. When the setlist is rendered, the appropriate gospel text appears based on the selected date

**API Response Example for `GET /api/federation/public/notes`:

```json
{
    "notes": [
        {
            "id": "gospel-sunday-a",
            "name": "Gospel for Sunday A",
            "period": "weekly",
            "languages": ["en", "es"],
            "periodic_behavior": "same",
            "last_fetched": "2026-11-01T12:00:00Z",
            "content_sections": [
                {
                    "type": "api",
                    "name": "gospel-api",
                    "api_url": "https://liturgical-api.example.com/gospel?lang=\${LANG}",
                    "resultSection": "text",
                    "authorization": null
                }
            ]
        },
        {
            "id": "psalm-sunday-a",
            "period": "weekly",
            "languages": ["en"],
            "periodic_behavior": "different_per_period",
            "last_fetched": "2026-11-01T12:00:00Z",
            "content_sections": [
                {
                    "type": "manual",
                    "md": "Reflection for the week"
                }
            ]
        }
    ]
}
```
## Using Subscribed Content

## Selecting content types to subscribe

When subscribing to a publisher, you can control which types of content are imported into your instance by setting the following environment variables:

- **`SONGBOOK_NOTES_FEDERATION`** (`false` by default): When `true`, allows subscription to recurrent notes from the publisher.
- **`SONGBOOK_SONGS_FEDERATION`** (`false` by default): When `true`, allows subscription to songs (with their associated albums) from the publisher.
- **`SONGBOOK_ARTISTS_FEDERATION`** (`false` by default): When `true`, allows subscription to artists from the publisher.

**Example combinations**:

- **Only notes**: Set `SONGBOOK_NOTES_FEDERATION=true`, and `SONGBOOK_SONGS_FEDERATION=false`, `SONGBOOK_ARTISTS_FEDERATION=false`
- **Only songs and artists**: Set `SONGBOOK_SONGS_FEDERATION=true`, `SONGBOOK_ARTISTS_FEDERATION=true`, `SONGBOOK_NOTES_FEDERATION=false`
- **Both notes and songs/artists**: Set all three variables to `true`

After configuring these variables, restart your instance for the changes to take effect.

After configuring these variables, add them to your `.env` file or `docker-compose.yml`:

```env
# Subscribe only to notes from publisher instances
SONGBOOK_NOTES_FEDERATION=true
SONGBOOK_SONGS_FEDERATION=false
SONGBOOK_ARTISTS_FEDERATION=false

# Or subscribe to songs and artists only
SONGBOOK_NOTES_FEDERATION=false
SONGBOOK_SONGS_FEDERATION=true
SONGBOOK_ARTISTS_FEDERATION=true

# Or subscribe to everything
SONGBOOK_NOTES_FEDERATION=true
SONGBOOK_SONGS_FEDERATION=true
SONGBOOK_ARTISTS_FEDERATION=true
```

After configuring these variables, restart your instance for the changes to take effect.
Once subscribers are configured:

1. **Content appears in browsing**: Songs, albums, and artists from the publisher appear alongside local content
2. **Visual distinction**: Subscribed content is marked with a "from [publisher name]" badge or grayed-out appearance
3. **Adding to setlists**: Users can add subscribed items to setlists — the setlist will reference the remote content
4. **Rendering**: When a setlist with subscribed content is rendered, the chords/lyrics are fetched from the original publisher instance at render time
5. **Missing content handling**: If the publisher removes or changes content, the setlist may show broken references gracefully

## Public Federation API Endpoints

Subscribed instances can discover and query public content via:

- **`GET /api/federation/public/capabilities`** — Returns the publisher's public federation capabilities
- **`GET /api/federation/public/albums`** — Lists available albums (read-only, paginated)
- **`GET /api/federation/public/artists`** — Lists available artists (read-only, paginated)
- **`GET /api/federation/public/songs`** — Lists available songs with basic metadata (read-only, paginated). Supports filtering by album, artist, language, and search terms
- **`GET /api/federation/public/song?id=<song-id>`** — Gets a specific song's metadata and ChordPro content (read-only)

## Security

- **Read-only**: No authentication required for GET requests to public federation endpoints
- **Write blocked**: POST/PUT/DELETE returns 403 Forbidden
- **Peer allowlist**: Only instances listed in `SONGBOOK_PUBLIC_FEDERATION_PEERS` are trusted
- **Admin control**: Admins can disable public federation at any time by setting `SONGBOOK_FEDERATION_PUBLIC=false`
- **Setlist link allowlists**: `SETLIST_LINK_EMBED_HOSTS` and `SETLIST_LINK_ALLOW_HTTP` are re-validated at render time

## Example: Multi-Campus Setup

```
Publisher:          Congregation A (main campus)
SONGBOOK_FEDERATION_PUBLIC=true
SONGBOOK_PUBLIC_FEDERATION_PEERS= (empty — publisher doesn't subscribe)

Subscribers:
  Congregation B:   SONGBOOK_PUBLIC_FEDERATION_PEERS=https://congregation-a.example.com
  Congregation C:   SONGBOOK_PUBLIC_FEDERATION_PEERS=https://congregation-a.example.com

Result: 
- Congregation B and C can search/sing songs from Congregation A
- Congregation A cannot automatically subscribe to B or C (unless configured)
- All content remains read-only from the publisher perspective
```

## Disabling Public Federation

To disable public federation, set `SONGBOOK_FEDERATION_PUBLIC=false`. Existing subscriptions remain in the configuration but new public federation requests are rejected, and subscribed content is no longer available.

## See also

- [ADR-0023 — Federation between songbook instances](./explanation/decisions/0023-federation-between-instances.md) — the architecture decision record
- [Environment variables](./docs/reference/environment-variables.md) — `SONGBOOK_FEDERATION_PUBLIC`, `SONGBOOK_PUBLIC_FEDERATION_PEERS`
- [Setlist share by token](./how-to/link-sheet-music-partitions.md) — sharing setlists differently