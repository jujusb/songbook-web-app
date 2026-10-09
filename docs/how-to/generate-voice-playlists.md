# Generate per-voice practice playlists

If your choir records each voice part separately and hosts them on a second Navidrome server
("VOICES"), the app can find the matching recordings for a setlist and generate one Navidrome share
per voice section. This gives every singer a link that plays only their part.

## Prerequisites

Configure the VOICES Navidrome instance with all three variables:

```bash
SONGBOOK_VOICES_NAVIDROME_SONGS_URL=https://voices.example.com
SONGBOOK_VOICES_NAVIDROME_USERNAME=navidrome
SONGBOOK_VOICES_NAVIDROME_PASSWORD=...
```

If any of the three is missing, the feature is off and no voice UI is rendered. The Navidrome server
must have sharing enabled. See [Enable music players](./enable-music-players.md).

## Naming the recordings

Recordings are matched to a setlist item by **title**, which must contain the song's title in the
setlist item's language plus a section label. Specific labels win over generic keywords:

| Label in title (case-insensitive) | Section |
| --- | --- |
| `chico alta` | tenor |
| `chico baja` | bass |
| `chica baja` | alto |
| `chica alta` | soprano |

If no specific label is present, generic keywords are used: `tenor`/`boy` → tenor, `bass` → bass,
`alto`/`girl` → alto, `soprano`/`sopran` → soprano. Every matching recording is included,
de-duplicated by title, so a song with several takes of the same part shows all of them.

## Generate the shares

1. Open a setlist you own (or can edit). The **voice playlists** panel appears when VOICES is
   configured.
2. Generate the shares. For each voice section that has matches, the app creates a Navidrome share
   and stores it on the setlist:

```yaml
voiceShares:
  - section: tenor
    url: https://voices.example.com/share/xxxx
    count: 3
    embeddable: true
```

3. The shares appear on the setlist page, on the read-only view, and on the shared setlist page, so
   singers get them from a share link without an account.

Generating requires the `setlist_creator` (or higher) role and ownership of the setlist. It runs in
read-only mode, which is why a public instance can offer practice playlists.

## On song pages

When VOICES is configured, every song page shows per-voice players split into **Chicos**
(tenor/bass) and **Chicas** (alto/soprano) tabs, using the same title matching. This is independent
of setlists and needs no generation step.

## Gotchas

- **Matching is text-based.** A recording whose title does not contain the song title and a section
  label will not be found. Rename your files.
- **Setlist language matters.** The matching uses the song's title in the language pinned to the
  setlist item, so a Spanish item looks for the Spanish title.
- **Shares are snapshots.** Regenerating replaces or adds shares; changing the setlist does not
  automatically update existing Navidrome shares.

## See also

- [Enable music players](./enable-music-players.md)
- [Share a setlist](./share-a-setlist.md)
- [ADR-0011 — Two Navidrome instances](../explanation/decisions/0011-two-navidrome-instances.md)
