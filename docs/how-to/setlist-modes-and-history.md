# Setlist modes and history

Setlists can be viewed in different modes depending on the use case, and their history can be tracked over time using a date-based version system. This is useful for congregations that use the same setlists for different purposes (rehearsals, concerts, individual practice) and want to preserve snapshots of setlist changes by date.

## History (date-based versions)

Each setlist keeps one **permanent root file** and a set of **dated snapshots**. Reusing the same setlist link for every event is the intended workflow: the root always holds the current/next event, while previous events are archived under dated folders.

### How it works

- **Current setlist**: `<data>/setlists/<setlist-id>.yaml` — the permanent link and the active version
- **Dated versions**: `<data>/setlists/<setlist-id>/<label>/setlist.yaml`
- **Automatic versions**: Before the root is overwritten, the previous root is archived if its content changed. Saving only metadata (public flag, share token/slug, subscribers, voice shares, mode, modified timestamp) does **not** create a version.
- **Version labels**: The setlist's `date` when available (`YYYY-MM-DD`). Creating a second dated version on the same day is rejected, so each link/day keeps a single entry. If a folder with that label already exists only from an identical snapshot, the existing entry is reused.
- **Storage layout**: The root file (`<setlist-id>.yaml`) keeps only shared/static link metadata (id, title, current date, public, share token/slug, owner, created, modified, subscribers). The song list, image, mode, description and voice shares live in `<setlist-id>/<date>/setlist.yaml`, including for the current event, so every version is self-contained.
- **Event dates**: History and statistics use the `YYYY-MM-DD` prefix of the version folder first, then fall back to the YAML `date`. Old snapshots with stale or missing YAML dates therefore still show the date they were archived under.
- **Saved shared setlists**: A reference (a setlist saved from a share link) resolves its history to the original setlist, so all subscribers see the same event timeline. The share page exposes that history read-only.

### Migrating older setlists

Older setlists stored the full current content in the root YAML file. Migrate them to the dated-version layout with:

```bash
npm run migrate:setlist-versions -- --dry
npm run migrate:setlist-versions
```

The script copies each root's current content into `<setlist-id>/<date>/setlist.yaml`, writes that date back to the root, and leaves only static link metadata in the root file. It can run more than once safely.

Root files without a date reuse the date of an existing version with identical content. Otherwise they use today's date; pass `--date YYYY-MM-DD` to choose a different date:

```bash
npm run migrate:setlist-versions -- --date 2026-11-01
```

If a version folder already exists for the current date with different content, the existing folder is preserved under a timestamped label before the current content takes the date label.


### Recurrent event workflow

1. Bookmark the permanent link, e.g. `/setlists/sunday-service`.
2. For each event, set the setlist date to the event date and update the songs/notes.
3. Save. The previous event is archived under its own date; the root now represents the new event.
4. Open the history section to browse past events.

Example:

```
<data>/setlists/
  sunday-service.yaml          ← current/next event
  sunday-service/
    2026-11-01/setlist.yaml    ← archived event
    2026-11-08/setlist.yaml
```

### Viewing and restoring history

- The **Version history** section appears below the setlist (and on its share page). Select a version to open it in the setlist view.
- Choosing a date in the **Version history** dropdown opens that dated setlist (`?version=<date>`). The dropdown always shows the version currently on screen.
- **New** opens the editor for a new dated version: choose the event date, image and song list, optionally copying them from the current setlist or a previous date, then confirm with **Create date setlist**. The current setlist is left untouched.
- Restoring and creating dated versions require `admin`/`reviewer`, or a `setlist_creator` who owns the setlist. In read-only deployments all history writes are disabled.

### Statistics

The **Statistics** page at `/setlists/stats` shows which songs were used across dated setlist events.

- **Periods**: rolling last 30 days, rolling last 365 days, or all time.
- **Scope**: admins and reviewers see all setlists; `setlist_creator` sees only their own (including setlists they saved from a share link).
- **Counting**: each song counts at most once per dated event. Current setlists and dated versions are both included when they have a usable event date.
- **References**: saved shared setlists are counted through their original setlist, so the same event is not counted twice.
- **Undated setlists** are skipped and reported separately. Use the language chips to filter the table.

### Configuration

| Variable | Default | Description |
|---|---|---|
| `SETLIST_DEFAULT_MODE` | `default` | Default mode for new setlists |
| `SETLIST_MODES_ALLOWED` | `default,public,guitarist,rehersal` | Comma-separated list of enabled modes |

#### Setting the default mode

```env
SETLIST_DEFAULT_MODE=default
```

#### Enabling/disabling modes

```env
# Only enable guitarist and public modes
SETLIST_MODES_ALLOWED=guitarist,public
```

### Modes

A setlist can be rendered in one of four modes, selected via the mode selector or URL query param `?mode=<key>`. When no `?mode` is present, the mode stored in the setlist's YAML frontmatter is used, falling back to `SETLIST_DEFAULT_MODE`.

#### Available modes

| Mode | Query param | Use case | What you see |
|---|---|---|---|
| **Default** | `?mode=default` | Personal use | Everything follows the logged-in user's profile preferences (chords, repeats, chord notation, inline chords, lyrics view, transpose, auto-scroll) |
| **Public** | `?mode=public` | Public performance / projection | Lyrics only, no chords, all songs expanded, fixed display settings independent of the user profile |
| **Guitarist** | `?mode=guitarist` | Guitar players | Chords over lyrics, fixed display settings independent of the user profile |
| **Rehearsal** | `?mode=rehersal` | Singers rehearsing | Voice playlists and per-song voice selection, lyrics only (no chords), list view |

Legacy mode names are still accepted and map to the new behaviours: `concert` → `public`, `instrumentalist` → `guitarist`, and the correct spelling `rehearsal` → `rehersal`.

#### Mode details

- **Default mode**: uses the user's saved display settings. Changing the display options or transposition from the UI saves them to the user profile for next time.
- **Public mode**: fixed lyrics-only rendering. No chord toggles, no transposition controls, no voice playlists.
- **Guitarist mode**: fixed chord rendering with transposition controls. Display preferences from the user profile are ignored (chords are always shown, using letter notation and separate chord rows).
- **Rehearsal mode**: fixed lyrics-only rendering with voice playlists and per-song voice selection. Display preferences from the user profile are ignored.

#### Switching modes

1. **Via the mode selector** (visible to setlist owners and admins):
   - Open a setlist and click the desired mode button
   - The mode is remembered via the URL (`?mode=<key>`)

2. **Via URL**:
   - Append `?mode=<key>` to the setlist URL, e.g.: `http://YOUR_INSTANCE/setlists/my-setlist?mode=public`
   - Useful for sharing a specific view with others

## See also

- [ADR-0024 — Setlist modes and history](./explanation/decisions/0024-setlist-modes-and-history.md) — the architecture decision record
- [Environment variables](./docs/reference/environment-variables.md) — `SETLIST_DEFAULT_MODE`, `SETLIST_MODES_ALLOWED`
- [Setlist share by token](./how-to/link-sheet-music-partitions.md) — sharing setlists with specific modes and dates