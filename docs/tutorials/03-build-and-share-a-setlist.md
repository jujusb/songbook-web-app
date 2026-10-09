# Tutorial 3 — Build and share a setlist

In this tutorial you will build a setlist from the songs in the library, present it, export it to
PDF, and hand out a link that works for people who are not logged in. It shows how setlists relate
to songs and how sharing is designed to be safe.

The app is running at <http://localhost:3000> and you are logged in as admin, from the previous
tutorials.

## 1. Create a setlist

Click **Setlists** in the header, then **New Setlist**.

The editor has three fields and a song picker:

- **Title** — required. The setlist's id is slugified from it.
- **Description** and **Date** — optional.
- A search box over the songs you are allowed to see. Adding a song appends it to the list, and
  each entry has its own language selector, because a setlist pins the *language* of each song,
  not just the song.

Add *Amazing Grace* and choose **Spanish** for it, so the setlist demonstrates a mixed-language
service. Reorder songs by dragging them. When you are happy, click **Save**.

You land on `/setlists/<setlist-id>`, which is the read/edit view. Because you are an editor you
get the **SetlistEditor**; someone with the `setlist_creator` role gets the same editor for their
own setlists; everyone else gets a read-only view.

## 2. Present it

At the top of the setlist are **Present** and **PDF** buttons.

Click **Present** to open the projection view at `/setlists/<setlist-id>/present`. This is a
fullscreen, high-contrast layout with no site chrome, intended for a projector or a large screen.
Use the arrow keys or spacebar to step through the songs and sections. Add `?display=audience` to
the URL to hide the chords and show lyrics only — the audience screen, as opposed to the band
screen. See [Use the projection view](../how-to/use-the-projection-view.md).

Close it and come back to the setlist.

## 3. Export the PDF

Click **PDF**. The export view lets you choose what to render; a setlist export uses the print
route under the hood and Puppeteer to produce a real PDF with the chords and Unicode text laid out
as you see them. See [Export a PDF](../how-to/export-a-pdf.md) for the scopes and options, and
[ADR-0013](../explanation/decisions/0013-pdf-from-our-own-print-route.md) for why the PDF is drawn
from the app's own print page instead of a PDF-drawing library.

## 4. Share it without an account

Back on the setlist page, the **sharing controls** panel is available to the owner and to
reviewers/admins. It lets you:

- **Toggles the setlist public** — anyone logged in can see it.
- **Create a share link** — generates a random token and produces a URL.
- **Give the link a custom slug** — replace the opaque token with something readable, so the link
  becomes `/setlists/share/sunday-morning`.

Create a share link, then set the slug to something memorable. The URL uses
`SONGBOOK_PUBLIC_URL` as its origin when that variable is set, so in a typical deployment the
shared link points at the read-only public instance rather than the private editor. See
[Run a public read-only instance](../how-to/run-a-public-read-only-instance.md).

Copy the link and open it in a private/incognito window. No login is required: the token *is* the
credential. You get a read-only setlist view, the per-voice practice playlists if they were
generated, and a PDF button. The share page never reveals the setlist id, the owner, or any
unpublished songs.

> If a visitor edits the token, they get a 404 — an unknown token is indistinguishable from a
> missing setlist. If you later **remove the share link**, every URL that used it stops working.
> See [ADR-0008](../explanation/decisions/0008-setlists-share-by-token.md) and
> [Share a setlist](../how-to/share-a-setlist.md).

## 5. What you created on disk

```bash
ls content/setlists
cat content/setlists/*.yaml
```

A setlist is one YAML file. It records the ordered songs with the language pinned per entry, the
owner, the public flag, and the share token/slug. Voice shares, if you generate them, are stored on
the same record. Nothing about the setlist is secret beyond the token, and the whole thing is
diffable and portable like the rest of the content.

## What you learned

- A setlist is an ordered list of songs, each pinned to a language, owned by one user.
- Sharing is opt-in and token-based: a public flag for logged-in users, and a random token or
  custom slug for everyone else.
- The projection and PDF outputs reuse the same song rendering as the reader.
- Share links prefer the public instance's URL, keeping the private instance private.

You have now used the three core workflows: reading songs, translating and publishing them, and
building shareable setlists. From here, use the [how-to guides](../how-to/README.md) for specific
tasks and the [explanation](../explanation/README.md) when you want to understand why the app is
shaped this way.
