# Setlist modes and history

Setlists can be viewed in different modes depending on the use case, and their history can be tracked over time using a date-based version system. This is useful for congregations that use the same setlists for different purposes (rehearsals, concerts, individual practice) and want to preserve snapshots of setlist changes by date.

## History (date-based versions)

Each setlist keeps one **permanent root file** and a set of **dated snapshots**. Reusing the same setlist link for every event is the intended workflow: the root always holds the current/next event, while previous events are archived under dated folders.

### How it works

- **Current setlist**: `<data>/setlists/<setlist-id>.yaml` — the permanent link and the active version
- **Dated versions**: `<data>/setlists/<setlist-id>/<label>/setlist.yaml`
- **Automatic versions**: Before the root is overwritten, the previous root is archived if its content changed. Saving only metadata (public flag, share token/slug, subscribers, voice shares, mode, modified timestamp) does **not** create a version.
- **Version labels**: The setlist's `date` when available (`YYYY-MM-DD`). If that folder already exists, a timestamp label is used instead (`YYYY-MM-DDTHH-MM-SS`, with `-N` on further collisions) so a version is never overwritten.
- **Event dates**: History and statistics use the YAML `date` first, then fall back to the `YYYY-MM-DD` prefix of the folder label. Old date-only folders keep working without migration.
- **Saved shared setlists**: A reference (a setlist saved from a share link) resolves its history to the original setlist, so all subscribers see the same event timeline. The share page exposes that history read-only.

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
- **Save date (copy)** creates a dated snapshot from the current root without changing the root. **Save date (empty)** creates an empty snapshot for that date (useful for planning a future event).
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
| `SETLIST_DEFAULT_MODE` | `guitarist` | Default mode for new setlists |
| `SETLIST_MODES_ALLOWED` | `rehersal,concert,guitarist,instrumentalist` | Comma-separated list of enabled modes |

#### Setting the default mode

```env
SETLIST_DEFAULT_MODE=guitarist
```

#### Enabling/disabling modes

```env
# Only enable guitarist and concert modes
SETLIST_MODES_ALLOWED=guitarist,concert
```

### Modes

A setlist can be rendered in one of four modes, selected via the mode selector or URL query param `?mode=<key>`. The mode is stored in the setlist's YAML frontmatter and persists across views.

#### Available modes

| Mode | Query param | Use case | What you see |
|---|---|---|---|
| **Public** | `?mode=public` | Public performance / projection | Lyrics only, fullscreen-friendly, no chord diagrams, minimal UI |
| **Guitarist** (default) | `?mode=guitarist` | Most common use, guitar players | Chords over lyrics, transposition control, chord diagrams, voice playlist (optional) |
| **Rehearsal** | `?mode=rehersal` | Singers rehearsing | Voice playlist part selection, no chord diagrams, lyrics with voice part highlights |
| **Concert** | `?mode=concert` | Public performance / projection | Lyrics only, fullscreen-friendly, no chord diagrams, minimal UI |
| **Instrumentalist** | `?mode=instrumentalist` | Other instrumentalists | Sheet music/partitions view, chord symbols simplified or omitted, focus on melody/parts |

#### Switching modes

1. **Via the mode selector** (visible to setlist owners and admins):
   - Open a setlist and look for the mode toolbar button
   - Click to cycle through enabled modes, or select a specific one
   - The mode is saved to the setlist's frontmatter

2. **Via URL**:
   - Append `?mode=<key>` to the setlist URL, e.g.: `http://YOUR_INSTANCE/setlists/my-setlist?mode=concert`
   - Useful for sharing a specific view with others

#### Mode details

- **Rehearsal mode**: Voice playlist, no chord diagrams, part selection per song
- **Concert mode**: Lyrics only, fullscreen-friendly, minimal UI
- **Guitarist mode** (default): Chords over lyrics, transposition control, chord diagrams
- **Instrumentalist mode**: Partition-oriented, melody focus, reduced chord symbols

## See also

- [ADR-0024 — Setlist modes and history](./explanation/decisions/0024-setlist-modes-and-history.md) — the architecture decision record
- [Environment variables](./docs/reference/environment-variables.md) — `SETLIST_DEFAULT_MODE`, `SETLIST_MODES_ALLOWED`
- [Setlist share by token](./how-to/link-sheet-music-partitions.md) — sharing setlists with specific modes and dates