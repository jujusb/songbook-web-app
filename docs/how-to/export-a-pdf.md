# Export a PDF

PDF export renders a print-layout page server-side and prints it with headless Chromium
(Puppeteer), so the PDF matches what the browser shows, including Unicode scripts, RTL text, and
chord alignment. There are two things you can export: **chords** and **instrumental** sheet music.

## From the UI

Open `/pdf` (the header's **Convert to PDF** button) and choose:

- **Type** — `chords` (songbook with chords) or `instrumental` (merged partition PDFs).
- **Scope** — `all`, `song`, `album`, `artist`, `book`, or `setlist`. The available scopes and
  items are filtered by what you are allowed to see.
- **Options** — language(s), whether to include references, and whether to repeat the chorus after
  each verse.

The **Print Songbook** button on the songs page and the **PDF** buttons on album, artist, and
setlist pages pre-select the relevant scope.

## From a setlist

A setlist's PDF pins each item's language, so a mixed-language setlist exports as written. Setlist
scope is access-controlled by `canViewSetlist`, so a shared setlist can only be exported through
its token (`?share=`).

## The print route

The exporter does not draw the PDF directly. It asks Puppeteer to load an internal print page —
`/print/<lang>` or a setlist print route — forwarding the session cookie so the print page sees the
same permissions, then calls `page.pdf()` to save it. This is why the app ships Chromium and the
Noto fonts in the image. See
[ADR-0013](../explanation/decisions/0013-pdf-from-our-own-print-route.md).

`/print` (without a language) is a config form; `/print/<lang>` is the actual printable book.

## Direct API calls

```
POST /api/pdf
{
  "type": "chords",
  "scope": "album",
  "id": "classic-hymns",
  "lang": "en",
  "refs": true,
  "repeatChorus": false
}
```

For instrumental:

```
POST /api/pdf
{
  "type": "instrumental",
  "scope": "song",
  "id": "amazing-grace",
  "instrument": "cuerdas",
  "files": ["cuerdas/Amazing Grace - guitar.pdf"]
}
```

`files` are intersected against the partitions the scope actually allows, so a caller cannot ask
the server to read an arbitrary path. See [API endpoints](../reference/api-endpoints.md).

## Page size

The default is A4. Change `pdfPageSize` in `content/config/site.yaml`. Common values are `A4` and
`Letter`.

## Troubleshooting

- **Empty export / 400.** The scope resolved to no songs, or the instrumental scope found no
  partition PDFs. Check that the content is published (for a public viewer) and that partitions are
  linked.
- **500.** Chromium failed to render. In Docker this should not happen, because the image installs
  Chromium and the fonts. On a bare host the app will not find a browser.
- **Blank glyphs.** A script is missing from the installed fonts. The image bundles Noto and Noto
  CJK; other scripts need extra fonts in the image.

## See also

- [Link sheet-music PDFs to songs](./link-sheet-music-partitions.md)
- [Configuration](../reference/configuration.md)
- [API endpoints](../reference/api-endpoints.md)
