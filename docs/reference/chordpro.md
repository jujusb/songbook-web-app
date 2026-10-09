# ChordPro subset

Song bodies are [ChordPro](https://www.chordpro.org/). The app parses them with ChordSheetJS
(`chordsheetjs ^15.5.2`) and also has its own pass for section detection and visual rendering. This
page lists what the app understands and what it adds.

## Chords and lyrics

```
[G]Amazing [G7]grace, how [C]sweet the [G]sound
```

A chord in square brackets before a syllable is rendered above it. Lines with no brackets are
lyrics. The visual renderer keeps chords aligned by position, not by counting characters, so wide
Unicode scripts stay aligned.

## Directives in use

| Directive | Effect |
| --- | --- |
| `{title: …}` | displayed title; kept in sync with `meta.yaml` `titles` |
| `{key: …}` | key shown by the reader |
| `{start_of_…}` / `{end_of_…}` | section boundaries; drive section labels, projection stepping, and repeat-chorus |

ChordSheetJS understands more directives (comments, `{define}`, etc.), and they pass through, but
the app's own UI acts on the ones above.

## Section types

The renderers recognise these section types
(`SECTION_TYPES`, `src/lib/chordpro/chord-utils.ts:47`):

`verse`, `chorus`, `bridge`, `prechorus`, `intro`, `outro`, `instrumental`, `interlude`, `coda`,
`tag`.

A section can carry a label after a colon:

```
{start_of_verse: 1}
...
{end_of_verse}
```

If no label is given, the type is used, title-cased (`verse` → `Verse`). Both `start_of_<type>`
and the short `s<type>` form are accepted by the section regex, with a matching
`end_of_<type>`/`e<type>`.

## Section aliases and normalization

The importers map many section names (English, Spanish, French) onto the canonical types above.
Examples: `verse`/`verso`/`estrofa`/`couplet` → `verse`; `chorus`/`coro`/`estribillo`/`refrain` →
`chorus`; `bridge`/`puente`/`pont` → `bridge`; `intro`/`introduction`/`introduccion` → 
`instrumental`. A trailing `final`/`finale`/`last`/`ultimos` is stripped before matching, so
"(Estribillo final)" resolves to `chorus`. The full map is in
`src/lib/chordpro/chord-utils.ts:64`.

`intro` is normalized to `instrumental` deliberately. See the genesis of that choice in the git
history around commit `b682e22`.

## Repeat chorus

The reader, print layout, and PDF export can repeat the chorus after each verse. This is a rendering
option (`repeatChorus`), not something written into the file. It uses the section map to find
chorus blocks and re-emit them.

## References

A reference in `meta.yaml` can anchor to a section by label (`verse: "1"`, `chorus: "…"`) or to a
content line index (`line`). Content-line indexing counts lyric and chord-only lines and skips
directives and blank lines, matching `isContentLine` in
`src/lib/chordpro/visual-parse.ts:98`.

## What the app does not do

- It does not read or write ChordPro configuration files other than the optional YAML frontmatter
  block above the body.
- It does not support ChordPro's inline `{comment}` as a visible feature; comments pass through the
  body but are not surfaced in the UI.
- It does not guarantee round-tripping of every ChordSheetJS feature through the visual editor; the
  editor works on lines and can rewrite chord placement on save.

## See also

- [Content model](./content-model.md)
- [Edit and publish a song](../how-to/edit-and-publish-a-song.md)
- [Use the projection view](../how-to/use-the-projection-view.md)
