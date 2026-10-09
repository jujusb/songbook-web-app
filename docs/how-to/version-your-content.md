# Put your content under version control

The content tree is designed to be a git repository. Everything the app stores is a text file, so
you get a diffable, revertible, portable history for free — separate from the app's own history.

## Initialise a repository

If your content lives outside the app checkout (the recommended production layout), version it
where it lives:

```bash
cd /srv/songbook/content
git init
git add .
git commit -m "Initial songbook content"
```

If you keep content inside the app repository (the development layout), it is already tracked.
You can still treat it as a standalone repository by making it a submodule or a nested repo.

## What to commit and what to leave out

| Path | Commit? | Why |
| --- | --- | --- |
| `config/site.yaml` | yes | app title, default language, PDF size, OIDC block |
| `library/**` | yes | albums, songs, translations |
| `artists/**` | yes | artist metadata |
| `setlists/**` | usually | setlists may contain share tokens; decide per project |
| `users/**` | **no** | bcrypt hashes, emails, and OIDC subjects are account data |
| `library/**/.revisions/**` | your call | every save writes a snapshot; committing them is a second history |

The app repository ignores `content/users/admin.yaml` for this reason. Add a `.gitignore` inside
your content repository to exclude the whole users directory:

```gitignore
users/
```

## Let the app commit for you

There is no built-in git automation in the running app despite an early note in
`songbook-web-app.md` suggesting one. Versioning is a manual, external step. A simple periodic
snapshot works well:

```bash
cd /srv/songbook/content
git add -A
git commit -m "content snapshot $(date -Iseconds)" || true
```

Run it from cron or a systemd timer. Because every edit is a plain file write, this captures
everything without cooperation from the app.

## Reverting

To roll back a translation, `git log`/`git checkout` the `.cho` file:

```bash
git log -- library/classic-hymns/amazing-grace/es.cho
git checkout <commit> -- library/classic-hymns/amazing-grace/es.cho
```

The app reads the file on the next request; there is no cache to invalidate beyond the normal
Next.js request revalidation.

## Moving to another host

There is no database to dump. Copy the folder:

```bash
rsync -a /srv/songbook/content/ newhost:/srv/songbook/content/
```

Point the new instance's `SONGBOOK_CONTENT_DIR` at it and start. Revisions move with the songs,
because they live inside the song folders.

## See also

- [Content model reference](../reference/content-model.md)
- [ADR-0001 — Files, not a database](../explanation/decisions/0001-files-not-a-database.md)
