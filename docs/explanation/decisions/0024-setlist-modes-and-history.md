# 0024 — Setlist modes and history

## Status

Accepted; partly superseded by [0028](./0028-manual-text-markdown-modes-and-date-flow.md) (default mode, fixed modes, legacy mode names).

## Date

2026-11-01

## Context

The songbook web app currently supports setlists as ordered lists of songs with optional notes and links. However, there is no built-in mechanism to:

- Track the history of setlist changes over time, with the ability to view previous versions
- Switch between different rendering modes for the same setlist depending on the use case (rehearsal, concert, individual practice, etc.)
- Provide mode-specific content: singers need voice playlists without chords, guitarists need chord diagrams, instrumentalists need sheet music partitions

As the app is used in more diverse contexts (campuses, concerts, rehearsals, intergenerational events), there is a need to:

- Preserve setlist snapshots over time while allowing new editions
- Offer tailored views of the same setlist content without requiring users to create duplicate setlists
- Support different roles and scenarios: rehearsal singers, concert performers, guitar accompaniment, other instrumentalists

## Decision

We will implement a setlist modes and history system based on the following principles and components:

### 1. Setlist History (date-based versions)

Rather than a revision tree of snapshots within the same setlist folder, each time a setlist is updated, a **new setlist version** is created with the current date. The history is a collection of these dated setlist versions.

#### 1.1. How it works

- When a setlist is saved (via `saveSongAction` or `createSongAction`), instead of creating a revision snapshot, a **new setlist folder** is created with a date-based name
- The new setlist version lives in: `content/setlists/<setlist-base-id>/<date>/`
  - Where `<date>` is format `YYYY-MM-DD` (e.g., `2026-11-01`)
  - The `<setlist-base-id>` is the original setlist ID (e.g., `my-setlist`)
- The current/active setlist remains at the root: `content/setlists/<setlist-base-id>.yaml`
- Previous dated versions are read-only snapshots that cannot be edited directly

#### 1.2. Version naming

- **Automatic versions**: Created on every save, named by `YYYY-MM-DD` date
- **Manual versions**: Admins can create a version with a custom label via the UI, which adds a subfolder with a descriptive name, e.g., `content/setlists/my-setlist/ christmas-2026/`
- The current active setlist always uses the `.yaml` at the root path

#### 1.3. Viewing history

- Users can view all dated versions of a setlist via a new route: `GET /setlists/<setlist-base-id>/history`
- The history view shows a timeline of all dated versions with their dates and labels
- Each version displays the setlist content as it was on that date
- Users can **switch to any previous version**, making it the current active setlist (this moves the dated folder's content to the root, or copies the content)

#### 1.4. Restoring previous versions

- To restore a previous dated version: the content from that version's folder is copied to the root setlist `.yaml` file
- This becomes the new active setlist, and a new date-based version is created on the next save
- Restoring requires `admin` role or setlist ownership

### 1.4. Security (recurrent events)

- History viewing: The history timeline of dated versions can be viewed by anyone if the setlist is public, forming a recurrent event log. Creating new dated versions requires `setlist_creator` role. Restoring previous versions requires `admin` role or setlist ownership.
- Dated versions are read-only — direct edits to dated folder contents are prevented; edits should be made via the history view or by restoring first.

### 2. Setlist Modes

Setlists can be rendered in different **modes**, each providing a tailored view of the content. The mode is stored in the setlist YAML frontmatter and persists across views.

#### 2.1. Mode definitions

| Mode | Key | Target audience | Content shown |
|---|---|---|---|
| **Rehearsal** | `rehersal` | Singers rehearsing | Voice playlist part selection, no chord diagrams, lyrics with voice parts highlighted, section to allow to listen voices records |
| **Concert** | `concert` | Performers/leaders | Lyrics only, no chord diagrams, lyrics with voice parts highlighted |
| **Public** | `public` | Public | Lyrics only, no chord diagrams, no voice parts, minimal UI (fullscreen suitable) |
| **Guitarist** | `guitarist` | Guitarists playing chords | Full chord diagrams, transposition control, lyrics with chord symbols, voice parts optional |
| **Instrumentalist** | `instrumentalist` | Other instrumentalists | Sheet music/partitions view, chord symbols simplified or omitted, focus on melody/parts |

#### 2.2. Mode implementation

- Each mode is a **client component** that receives the setlist data as props
- The mode is determined by a query param `?mode=<key>` or from the setlist's stored mode
- Modes can be switched by users with appropriate role permissions
- The default mode is `guitarist` for backward compatibility

##### 2.2. Mode implementation

Each mode is a **client component** that receives the setlist data as props. The mode is determined by a query param `?mode=<key>` or from the setlist's stored mode. Modes can be switched by users with appropriate role permissions. The default mode is `guitarist` for backward compatibility.

##### 2.2.1. Rehearsal mode (`mode=rehersal`)

- Shows a **voice playlist** similar to the existing voice playlists UI
- Part selection per song (gender/section chooser)
- **No chord diagrams** displayed — lyrics only with voice part labels
- Includes a "practice tempo" controller (optional future feature)
- Voice parts are highlighted as the song progresses (optional, using intersection Observer)
- Users can select their preferred voice part per song

##### 2.2.2. Concert mode (`mode=concert`)

- **Lyrics-only view** — no chord diagrams, no navigation between songs except through setlist ordering
- Designed for fullscreen projection during services
- "Open in new tab" link for distraction-free view
- No voice part selection, no transpose control visible
- Can be set to auto-advance between songs (optional)

##### 2.2.3. Guitarist mode (`mode=guitarist`)

- **Full chord sheet view** — chords over lyrics, transposition control
- Shows chord diagrams in a sidebar or inline
- Includes the existing voice playlist UI (for singers in the group)
- Transpose control visible and functional
- Default mode for new setlists

##### 2.2.4. Instrumentalist mode (`mode=instrumentalist`)

- **Partitions view** — simplified sheet music rendering
- Shows melody line, lyrics, and chord symbols reduced or omitted
- Focus on the individual part/instrument
- May integrate with external sheet music services or display ChordPro with simplified formatting
- Voice parts are not the focus; instead, instrumental parts are highlighted

##### 2.2.5. Public mode (`mode=public`)

- **Lyrics-only view** — no chord diagrams, no voice part selection
- Designed for fullscreen projection during services
- No voice part selection, no transpose control visible
- Designed for distraction-free viewing, suitable for projection during services
- Can be set to auto-advance between songs (optional)

### 3. Configuration

| Variable | Default | Description |
|---|---|---|
| `SETLIST_DEFAULT_MODE` | `guitarist` | Default mode for new setlists |
| `SETLIST_MODES_ALLOWED` | `public,guitarist,rehersal,concert,instrumentalist` | Comma-separated list of enabled modes |

#### 3.1. Mode enable/disable

- Administrators can enable/disable modes via `SETLIST_MODES_ALLOWED`
- By default all five modes are enabled
- Disabling a mode hides it from the mode selector UI

#### 3.2. Mode switching

- Users can switch modes via a toolbar button (visible based on role)
- The mode selector shows only enabled modes
- Mode changes are persisted in the setlist's frontmatter (`mode: concert`)
- URL reflects the mode: `?mode=concert` (for sharing specific views)


- Shows a **voice playlist** similar to the existing voice playlists UI
- Part selection per song (gender/section chooser)
- **No chord diagrams** displayed — lyrics only with voice part labels
- Includes a "practice tempo" controller (optional future feature)
- Voice parts are highlighted as the song progresses (optional, using intersection Observer)
- Users can select their preferred voice part per song

##### 2.2.2. Concert mode (`mode=concert`)

- **Lyrics-only view** — no chord diagrams, no navigation between songs except through setlist ordering
- Designed for fullscreen projection during services
- "Open in new tab" link for distraction-free view
- No voice part selection, no transpose control visible
- Can be set to auto-advance between songs (optional)

##### 2.2.3. Guitarist mode (`mode=guitarist`)

- **Full chord sheet view** — chords over lyrics, transposition control
- Shows chord diagrams in a sidebar or inline
- Includes the existing voice playlist UI (for singers in the group)
- Transpose control visible and functional
- Default mode for new setlists

##### 2.2.4. Instrumentalist mode (`mode=instrumentalist`)

- **Partitions view** — simplified sheet music rendering
- Shows melody line, lyrics, and chord symbols reduced or omitted
- Focus on the individual part/instrument
- May integrate with external sheet music services or display ChordPro with simplified formatting
- Voice parts are not the focus; instead, instrumental parts are highlighted

### 3. Configuration

| Variable | Default | Description |
|---|---|---|
| `SETLIST_DEFAULT_MODE` | `guitarist` | Default mode for new setlists |
| `SETLIST_MODES_ALLOWED` | `public,guitarist,rehersal,concert,instrumentalist` | Comma-separated list of enabled modes |

#### 3.1. Mode enable/disable

- Administrators can enable/disable modes via `SETLIST_MODES_ALLOWED`
- By default all four modes are enabled
- Disabling a mode hides it from the mode selector UI

#### 3.2. Mode switching

- Users can switch modes via a toolbar button (visible based on role)
- The mode selector shows only enabled modes
- Mode changes are persisted in the setlist's frontmatter (`mode: concert`)
- URL reflects the mode: `?mode=concert` (for sharing specific views)

### 4. Carried-forward changes

The following new files and functions will be added:

- **`src/lib/setlist-history.ts`** — History management: date-based version creation, viewing, restoring
- **`src/app/setlists/[setlistId]/history/route.ts`** — API route for setlist history views
- **`src/components/SetlistModeSelector.tsx`** — Component for switching between modes
- **`src/components/SetlistRehearsalView.tsx`** — Rehearsal mode voice playlist view
- **`src/components/SetlistConcertView.tsx`** — Concert mode lyrics-only view
- **`src/components/SetlistGuitaristView.tsx`** — Guitarist mode with chords
- **`src/components/SetlistInstrumentalistView.tsx`** — Instrumentalist mode partitions view
- **`src/lib/config.ts`** — New `getSetlistDefaultMode()`, `getSetlistModesAllowed()` functions
- **Setlist schema adjustments** in `src/lib/content/` — add `mode` field, history metadata (base setlist ID and current date)
- **Environment variables** listed in section 3 above (added to `.env.example` and `docker-compose.yml`)
- **`docs/how-to/setlist-modes-and-history.md`** — User guide

### 5. Consequences

#### Positive

- **Date-based history**: Clear timeline of setlist versions, each with its own date
- **No revision tree complexity**: Simpler storage structure — just dated setlist folders
- **Mode flexibility**: The same setlist content can be viewed in four ways suited to different users and scenarios — no need to maintain duplicate setlists
- **Backward compatibility**: Default mode is `guitarist`, preserving existing behavior for existing setlists
- **Role-aware**: Different modes are visible/accessible based on user roles
- **Simple audit trail**: Each date represents a specific version; restoring is copying content from a dated folder

#### Negative

- **Storage growth**: Each save creates a new dated folder, which consumes disk space
- **UI complexity**: Four modes plus history browsing adds complexity to the setlist editor and reader UIs
- **Version management**: Users need to manage which dated version is the "current" one
- **Migration from existing setlists**: Existing setlists without date-based history need to be converted or kept as the baseline version

#### Carried forward

- All existing setlist content (songs, notes, links) remains unchanged
- `SETLIST_LINK_EMBED_HOSTS` and `SETLIST_LINK_ALLOW_HTTP` allowlists still apply across all modes
- Role-based access control (`canEdit`, `canAdmin`) applies to history restore operations

### 6. Evidence

- `src/lib/setlist-history.ts` — to be created with date-based version orchestration, viewing/restoring
- `src/app/setlists/[setlistId]/history/route.ts` — API route: GET /setlists/<setlistId>/history
- `src/components/SetlistModeSelector.tsx` — mode switching toolbar component
- `src/components/SetlistRehearsalView.tsx` — rehearsal mode with voice playlist
- `src/components/SetlistConcertView.tsx` — concert mode lyrics-only
- `src/components/SetlistGuitaristView.tsx` — guitarist mode with chords
- `src/components/SetlistInstrumentalistView.tsx` — instrumentalist mode partitions
- `src/lib/config.ts` — `getSetlistDefaultMode()`, `getSetlistModesAllowed()`, etc.
- `.env.example` — new `SETLIST_DEFAULT_MODE`, `SETLIST_MODES_ALLOWED` entries
- `docker-compose.yml` — `SETLIST_DEFAULT_MODE`, `SETLIST_MODES_ALLOWED` env vars added
- `docs/how-to/setlist-modes-and-history.md` — user guide

### 7. Coordination

This ADR should be read in conjunction with:

- [0001 — Files, not a database](./0001-files-not-a-database.md) — the foundational file-based design
- [0008 — Setlists share by token](./0008-setlists-share-by-token.md) — setlist sharing interacts with mode/history links
- [0019 — Setlist references and subscribers](./0019-setlist-references-and-subscribers.md) — setlist references work across modes
- [0020 — Setlist lyrics view and preferences](./0020-setlist-lyrics-view-and-preferences.md) — lyrics view is relevant to concert mode
- [0021 — Setlist song limit and voice playlists](./0021-setlist-song-limit-and-voice-playlists.md) — voice playlists carry over to rehearsal mode
- [0023 — Federation between songbook instances](./0023-federation-between-instances.md) — federation respects setlist modes when syncing
- [Environment variables](./docs/reference/environment-variables.md) — new `SETLIST_*` entries