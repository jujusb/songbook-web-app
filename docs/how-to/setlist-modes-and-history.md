# Setlist modes and history

Setlists can be viewed in different modes depending on the use case, and their history can be tracked over time using a date-based version system. This is useful for congregations that use the same setlists for different purposes (rehearsals, concerts, individual practice) and want to preserve snapshots of setlist changes by date.

## History (date-based versions)

Instead of a revision tree of snapshots within the same setlist folder, each time a setlist is updated, a **new dated version** is created. The history is a collection of these dated setlist versions.

### How it works

- **Current setlist**: Lives at `content/setlists/<setlist-id>.yaml` and is the active version
- **Dated versions**: Each time the setlist is saved, a new folder is created at `content/setlists/<setlist-id>/<YYYY-MM-DD>/` containing the setlist YAML and any associated files
- **Automatic versions**: Created on every save, automatically named by the current date (`YYYY-MM-DD`)
- **Manual versions**: Admins can create a version with a custom label (e.g., "Christmas 2026", "Easter service") via the UI, which adds a descriptively-named folder
- **Current vs. historical**: The root `setlists/<id>.yaml` is always the current active version. Dated folders are historical snapshots

### Viewing history

1. **Open the history view**: Append `/history` to the setlist URL, e.g.:
   `http://YOUR_INSTANCE/setlists/my-setlist/history`
2. **See the timeline**: All dated versions are shown with their dates (and labels for manual versions)
3. **Switch to a previous version**: Click on any date to make that version the current active setlist
   - When you switch to a previous date, the content from that dated folder becomes the new root `setlists/<id>.yaml`
   - A new date-based version is created on the next save
4. **Create a manual version**: In the history view, enter a label to create a snapshot that will never be automatically pruned

### Creating a new setlist version with a specific date

You can create a new dated version of the setlist by appending `?date=YYYY-MM-DD` to the setlist URL. This saves the current setlist state as a new version with the specified date.

- **Example**: `http://YOUR_INSTANCE/setlists/my-setlist?date=2026-11-01`
- **Effect**: The current setlist content is saved as `content/setlists/my-setlist/2026-11-01/` and becomes a historical version
- **Current setlist**: The root `setlists/my-setlist.yaml` remains unchanged (the current active version)
- **Recurrent event workflow**:

  1. **Bookmark the setlist link**: `/setlists/my-recurrent-setlist` — this is the permanent link used for all events
  2. **After each event**: Save the setlist state with the event date:
     - `http://YOUR_INSTANCE/setlists/my-recurrent-setlist?date=2026-11-01`
     - This saves the current content as the November 1, 2026 version under `content/setlists/my-recurrent-setlist/2026-11-01/`
     - The root `setlists/my-recurrent-setlist.yaml` remains the current version for the next event
  3. **View the history of all events**: Append `/history` to see the timeline:
     - `http://YOUR_INSTANCE/setlists/my-recurrent-setlist/history`
     - Shows all past dates with labels (e.g., "Nov 1", "Nov 8", "Christmas Service")
  4. **Switch to a past event**: Click any date in history to make that version the current active setlist

  **Example: Weekly Sunday Service**

  ```
  Setlist link (permanent):  http://YOUR_INSTANCE/setlists/sunday-service

  Event 1:            Event 2:            Event 3:
  Nov 1, 2026         Nov 8, 2026         Nov 15, 2026
  ?date=2026-11-01    ?date=2026-11-08    ?date=2026-11-15

  content/setlists/
    sunday-service.yaml     ← current (next event)
    sunday-service/
      2026-11-01/           ← Nov 1 version
        meta.yaml
        en.cho
        es.cho
      2026-11-08/           ← Nov 8 version
        meta.yaml
        en.cho
      2026-11-15/           ← Nov 15 version
        meta.yaml
        en.cho
  ```

- **Role requirement**: Requires at least `setlist_creator` role to create a new dated version. However, all readers (even without login) can view the history timeline of dated versions if the setlist is public, though creating or restoring versions requires appropriate permissions.

### Combining with mode parameter

You can combine the date parameter with the mode parameter:
- `http://YOUR_INSTANCE/setlists/my-setlist?date=2026-11-01&mode=concert`
- This saves the current setlist in concert mode as the version for that date

### Restoring previous versions

- To restore a previous dated version: clicking on that version in the history view makes it the current active setlist
- The content from that dated folder replaces the root `setlists/<id>.yaml`
- Restoring requires `admin` role or setlist ownership
- After restoring, the next save will create a new dated version based on the restored content

### Security

- **Viewing history**: Requires at least `setlist_creator` role for the setlist's owner, or `public` role for public setlists
- **Restoring versions**: Requires `admin` role or being the setlist owner
- **Dated versions are read-only**: Direct edits to dated folder contents are prevented; edits should be made via the history view or by restoring first

### Example folder structure after several months

```
content/setlists/
  my-setlist.yaml              ← current active setlist
  my-setlist/                  ← dated versions folder
    2026-10-15/                ← October 15, 2026 version
      meta.yaml
      en.cho
      es.cho
    2026-11-01/                ← November 1, 2026 version (maybe a manual "conference" version)
      meta.yaml
      en.cho
    christmas-2026/            ← manually-labeled version
      meta.yaml
      en.cho
```

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