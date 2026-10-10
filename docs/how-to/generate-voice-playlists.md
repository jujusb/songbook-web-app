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
setlist item's language plus a section label. The matching rules are **language-dependent**: each
song language resolves its own set of labels, so `es` recordings can use Spanish labels while `en`
or `fr` recordings use English or French keywords.

The **universal generic keywords** apply to every language: `tenor`/`boy` → tenor, `bass` → bass,
`alto`/`girl` → alto, `soprano`/`sopran` → soprano.

The **Boy / Girl convention** is the recommended way to point a recording at *both* sections
of a gender — it applies to every language:

- `Boy` → **tenor + bass**
- `Girl` → **alto + soprano**

So a recording named `My Song Boy` shows up for both tenor and bass, and `My Song Girl` for
alto and soprano, no matter the song's language. Specific labels and single-section keywords still
work on top of this.

For `es` (and any language without its own rules), **specific labels win over generic keywords:**

| Label in title (case-insensitive) | Section |
| --- | --- |
| `chico alta` / `chicos alta` | tenor |
| `chico baja` / `chicos baja` | bass |
| `chica baja` / `chicas baja` | alto |
| `chica alta` / `chicas alta` | soprano |

The bare gender words of the built-in `es` mapping (`chico`, `chicos`, `chica`, `chicas`) are
Boy/Girl words too — they map to *both* sections of that gender, exactly like the universal
`Boy`/`Girl` tokens. For `fr`, the only extension over the universal keywords is
`basse` → bass; for `en` no extra labels exist, so recordings for English songs should use the
universal tokens (`Boy`/`Girl`) or the generic keywords (`boy`, `girl`, …).

### Override the vocabulary with a JSON file

The built-in per-language mapping above lives in code (`LANG_PARAMS` in
`src/lib/navidrome/voices.ts`). You can replace parts of it **without touching code** with a JSON
file kept in the content tree — because `content/` is bind-mounted into Docker, dropping the file in
is all it takes:

```
content/config/voices.json
```

Shape (each language entry may omit any dimension):

```json
{
  "matching": {
    "de": {
      "specific": { "fuer stimme": "tenor" },
      "Boy": ["jungs"],
      "Girl": ["maedchen"],
      "keywords": { "lead": "tenor" }
    }
  }
}
```

Semantics:

- **`specific`** — an object of `label → section`, which pins a title to exactly that section and
  wins over everything else. Replaces the language's built-in `specific` labels.
- **`Boy` / `Girl`** — arrays of words that map a title to *both* sections of the gender
  (like the universal `Boy`/`Girl` words, which always stay active on top). Replaces that
  language's built-in bare-gender words.
- **`keywords`** — an object of `word → section`, fallback matches after Boy/Girl. Replaces
  that language's built-in keywords.
- For a language, each provided dimension **replaces** the built-in one; an absent dimension keeps
  the built-in value. Universal keywords and universal Boy/Girl words cannot be removed.
- Unknown languages without their own entry still fall back to the built-in `es` mapping.
- If the file is missing, malformed, or empty, the built-in mapping is used unchanged.

To point at a file elsewhere (for example one mounted on its own volume), set
`SONGBOOK_VOICES_MATCHING_FILE` to its absolute path inside the container — see
[Environment variables](../reference/environment-variables.md).

### UI labels are separate from the search vocabulary

The words used to *find* recordings on Navidrome (the tokens above) are independent from the words
shown in the UI. The gender tabs are localized: **Boy**/**Girls** in English, **Chicos**/**Chicas**
in Spanish, **Garçons**/**Filles** in French — configured as i18n strings, not as matching tokens.
The section names are localized too (e.g. **Bass**/**Tenor**/**Alto**/**Soprano** in English,
**Bajo**/**Tenor**/**Contralto**/**Soprano** in Spanish, **Basse**/**Ténor**/**Alto**/**Soprano** in
French), under the `voice.sections.*` i18n keys. You can rename Navidrome recordings to match your
own Boy/Girl vocabulary without changing anything a singer sees.

Every matching recording is included, de-duplicated by title, so a song with several takes of the
same part shows all of them.

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

When VOICES is configured, every song page shows per-voice players split into localized **Boy**
(tenor/bass) and **girls** (alto/soprano) tabs, using the same language-dependent title matching.
This is independent of setlists and needs no generation step.

A logged-in user can set their own voice on their `/profile` page (`voice:` in their user YAML).
When that section has recordings for a song, it is selected by default in the song players and in
the setlist voice playlists, so each singer opens the app with their part already active.

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
