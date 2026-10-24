# Setlist Lyrics View and Shared Setlist References

## Setlist Lyrics View

The setlist page (`/setlists/[setlistId]`) now includes an expandable lyrics view that lets you see all song lyrics in the setlist at once, with per-song transpose controls and global display options.

### Features

- **Display All / Retract All**: Toggle between showing all song lyrics expanded or just the song list
- **Per-song transpose**: Each song has its own transpose controls (+/- semitones, reset) that persist across sessions
- **Global options panel** (collapsible):
  - **Show Chords**: Toggle chord visibility globally
  - **Repeat Sections**: Toggle repeated section expansion
  - **Chord Notation**: Choose between Letters, Solfege, Roman Numerals, or Nashville Numbers
  - **Inline Chords**: Show chords inline with lyrics instead of on separate rows
- **Per-song expand/collapse**: Click any song row to expand/collapse individual songs (when not in "Display All" mode)
- **Mobile-friendly**: Lyrics have `max-h-96 overflow-y-auto` for scrolling on mobile

### User Preferences

The following preferences are persisted per user and applied as defaults:

| Preference | Storage | Description |
|------------|---------|-------------|
| `setlistLyricsView` | User profile | Default view mode: `all` (expanded) or `list` (collapsed) |
| `inlineChords` | User profile | Default inline chords setting |
| `showChords` | User profile | Default chord visibility |
| `showRepeats` | User profile | Default repeat sections setting |
| `chordNotation` | User profile | Default chord notation |
| `setlistTranspose` | User profile | Per-setlist, per-song transpose offsets (semitones) |

These can be changed via the global options panel on any setlist page, and changes are saved to your user profile via server actions.

### Keyboard Shortcuts

- **Click song row**: Expand/collapse individual song (in "list" mode)
- **Transpose buttons**: +/- to transpose, reset button to return to original key

---

## Shared Setlist References

You can save a shared setlist (accessed via a share link) to your personal library. This creates a **reference setlist** in your library that points to the original.

### How it works

1. Open a shared setlist via its share link (e.g., `/setlists/share/<token>`)
2. Click **"Save to My Library"** button
3. A reference setlist is created in your library with:
   - Same title, description, date, and songs as the original
   - Empty `songs` array (songs are loaded from the original via `sharedFrom`)
   - `sharedFrom` metadata pointing to the original setlist
   - Your user ID added to the original's `subscribers` list

### Behavior

- **Changes to the original are reflected automatically**: Adding/removing/reordering songs in the original setlist immediately updates all references
- **Read-only access**: Subscribers can view the setlist and use the lyrics view, but cannot edit the setlist structure (songs, order, title, etc.)
- **Personal transpose/settings**: Each subscriber has their own transpose settings and display preferences for the setlist
- **Original owner retains full control**: Only the original owner can edit the setlist structure

### Managing References

- **View Original**: Link on the reference setlist page to navigate to the original
- **Remove from Library**: Removes the reference from your library and unsubscribes you from the original (original owner and other subscribers unaffected)
- **List page badge**: Reference setlists show a "Saved from shared setlist" badge on the setlists list page

### Access Control

| Action | Original Owner | Subscriber | Public (share link) |
|--------|---------------|------------|---------------------|
| View setlist | ✅ | ✅ | ✅ (with token) |
| Edit setlist (songs, order, title) | ✅ | ❌ | ❌ |
| Delete setlist | ✅ | ❌ (only remove ref) | ❌ |
| Generate share link | ✅ | ❌ | ❌ |
| View inline lyrics | ✅ | ✅ | ✅ |
| Personal transpose | ✅ | ✅ (own copy) | ❌ |
| Personal display options | ✅ | ✅ (own copy) | ❌ |
| Save as reference | N/A | ✅ | ❌ |

---

## API Endpoints

### Save Shared Setlist
```
POST /api/songs/[id]/publish-chords?lang=<lang>
```
Toggles the `chordsPublished` flag for a song translation.

### Server Actions

| Action | Description |
|--------|-------------|
| `saveSharedSetlistAction(shareToken)` | Save a shared setlist to user's library as a reference |
| `removeSavedSetlistAction(setlistId)` | Remove a saved reference setlist and unsubscribe |
| `updateSetlistLyricsViewAction(mode)` | Update default lyrics view mode (`all` | `list`) |
| `updateSetlistGlobalOptionsAction(options)` | Update global display options |
| `updateSetlistTransposeAction(setlistId, songId, semitones)` | Update per-song transpose for a setlist |

---

## Implementation Details

### Reference Setlist Structure

A reference setlist has:
- `sharedFrom`: `{ setlistId, shareToken, savedAt }` - points to original
- `songs: []` - empty, loaded from original at render time
- `subscribers: []` - empty (subscribers tracked on original only)

### Content Layer Merging

The `getSetlist(id)` function automatically merges reference setlists with their originals:
- Original's mutable content (title, description, date, songs, voiceShares) overrides reference
- Reference's metadata (id, ownerId, sharedFrom, subscribers, created) preserved
- **Note**: `subscribers` is currently NOT merged (reference has empty array). Check original setlist for subscriber list.

### Subscriber Tracking

- Original setlist tracks `subscribers: string[]` (user IDs)
- When a user saves a shared setlist, their user ID is added to original's `subscribers`
- When a user removes a reference, their user ID is removed from original's `subscribers`
- `listSetlists({ userId })` includes reference setlists owned by that user
- `canViewSetlist()` checks `isSubscriber` flag for reference access