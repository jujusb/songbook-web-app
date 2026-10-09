# Use the projection view

The projection view is a fullscreen, high-contrast, large-type rendering of a song or a setlist,
meant for a projector or a wall display. It has no site chrome and is driven by the keyboard.

## Open it

- **A single song:** `http://host/present/<song-id>` (optionally `?lang=es`).
- **A setlist:** `http://host/setlists/<setlist-id>/present`, which walks through the setlist's
  songs in order.
- **A shared setlist:** `http://host/setlists/share/<token-or-slug>/present`.

## Keyboard controls

| Key | Action |
| --- | --- |
| `→` or `Space` | next section; past the last section, next song |
| `←` | previous section; before the first section, previous song |
| `C` | toggle chords on/off |
| `Esc` | go back |

## Audience mode

Add `?display=audience` to hide the chords and show lyrics only. The intended setup is a controller
screen with chords for the band and a second window or display in audience mode for the
congregation, both on the same song.

```
http://host/setlists/<setlist-id>/present
http://host/setlists/<setlist-id>/present?display=audience
```

## Sections

The projection view steps by **section**, not by line. Sections come from the ChordPro structure:
`{start_of_verse}`/`{end_of_verse}`, `{start_of_chorus}`/`{end_of_chorus}`, and
`{start_of_instrumental}`. If a song has no explicit sections, the whole body becomes one section,
so navigation between songs still works. See [ChordPro subset](../reference/chordpro.md).

## Notes

- The view is public for published content and follows the same unpublished rule as the reader:
  admins can project anything, everyone else only what is published. Unlike the reader, the raw
  `/present/<song-id>` route does not itself re-check the published flag, so treat the route as one
  to link to from content rather than advertise directly.
- There is no server-side state. Refreshing a projected setlist starts at the first section.
- The dual-window BroadcastChannel mode sketched in `songbook-web-app.md` was never built; the
  documented way to drive two displays is two browser windows following the same URL.

## See also

- [Share a setlist](./share-a-setlist.md)
- [Tutorial 3 — Build and share a setlist](../tutorials/03-build-and-share-a-setlist.md)
