# Share a setlist

Setlists can be private, public to logged-in users, or shareable through a token or a readable
slug. Sharing is designed so a visitor with a link never needs an account and never sees anything
beyond that one setlist.

## The three levels

| Level | Who can see it | How it is set |
| --- | --- | --- |
| Private | the owner and editors | default |
| Public | any logged-in user | **public** toggle |
| Shared | anyone with the link | create a share token / slug |

## Create a share link

On the setlist page, find the sharing controls panel. It is available to the owner and to
reviewers/admins.

1. Click **Create share link**. This generates a random `shareToken` and produces a URL:
   `/setlists/share/<token>`.
2. Optionally type a **slug** and save. The link becomes `/setlists/share/<your-slug>`. Slugs must
   match `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,59}$` and be unique; saving an empty slug clears it and falls
   back to the token.
3. Click the link to copy it.

The origin of the link is `SONGBOOK_PUBLIC_URL` when set, otherwise the current request origin. In a
two-instance deployment, set it to the public instance's hostname so the link works without login.
See [Run a public read-only instance](./run-a-public-read-only-instance.md).

## What a visitor gets

Opening the link takes them to a read-only setlist view with the per-voice playlists (if generated)
and a PDF button. No login, no site navigation into the rest of the library, no unpublished songs,
and no setlist id or owner information. The token is the credential.

## Revoke access

- **Remove the share link** deletes the token, so every URL that used it stops working.
- **Toggle public off** removes it from the logged-in setlist list without affecting a share link.
- Deleting the setlist removes everything.

## Security notes

- An unknown token returns a 404, indistinguishable from a setlist that does not exist. There is no
  way to enumerate tokens.
- Share tokens are random; slugs are guessable by design, so use them only when the content is
  meant to be public and the URL is meant to be read aloud.
- Share pages are covered by `canViewSetlist`, which also gates the setlist PDF export. A visitor
  cannot use the share token to reach the private instance's editor.

## See also

- [Tutorial 3 — Build and share a setlist](../tutorials/03-build-and-share-a-setlist.md)
- [ADR-0008 — Setlists share by token](../explanation/decisions/0008-setlists-share-by-token.md)
- [Generate voice playlists](./generate-voice-playlists.md)
