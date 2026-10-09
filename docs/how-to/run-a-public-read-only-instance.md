# Run a public read-only instance

Read-only mode turns a write-capable instance into a public one. It is designed for a deployment
where the main songbook is private but congregation members should be able to browse songs *and*
build their own setlists.

## Turn it on

Set `SONGBOOK_READONLY=1` and mount the content directories read-only:

```yaml
services:
  songbook-public:
    image: songbook-web-app:latest
    ports:
      - "9000:3000"
    volumes:
      - ./content:/app/content:ro
      - ./music:/app/music:ro
      - ./partitions:/app/partitions:ro
    environment:
      - SONGBOOK_READONLY=1
      - JWT_SECRET=...
      - SONGBOOK_PUBLIC_URL=https://songbook.example.com
```

The repository's own `docker-compose.yml` already defines this service; `SONGBOOK_PUBLIC_PORT`
chooses its port, and it defaults to 9000.

Set `SONGBOOK_PUBLIC_URL` to the public hostname. Setlist share links are built from it, so they
point at the public instance even when the link is generated on the private one.

## What still works

Read-only mode is not "no writes at all". It deliberately keeps a small set of operations so the
public instance is useful:

- **Reading** everything the visitor is allowed to see.
- **Login, logout and self-registration.** New self-registered users get the `setlist_creator`
  role.
- **Setlist creation, editing, and sharing** for the user's own setlists, including the public
  flag, share tokens, custom slugs, and voice playlist generation.

## What is blocked

Every other write returns a 403, or the route behaves as if it does not exist (`notFound()`):

- editing songs, adding/removing translations, publishing revisions,
- creating, renaming, or deleting songs, albums, and artists,
- user management and partition scanning,
- the Song/Album/Artist POST, PUT and DELETE endpoints.

See [Read-only mode](../reference/read-only.md) for the exact operation list and
[ADR-0007](../explanation/decisions/0007-read-only-mode-is-a-deployment-profile.md) for why
setlists were singled out.

## A two-instance topology

The typical deployment is:

```
              ┌─────────────────────┐
public  ───▶  │ songbook-public     │  SONGBOOK_READONLY=1, content:ro
              │ :9000               │  login + setlists + reading
              └─────────────────────┘

              ┌─────────────────────┐
editors ───▶  │ songbook            │  full write access, content:rw
              │ :3000 (private)     │
              └─────────────────────┘
```

Both instances read the same `content/` folder. The public one mounts it read-only at the filesystem
level, so even a bug in the read-only checks cannot corrupt the library. Editors use the private
instance; visitors use the public one. `SONGBOOK_PUBLIC_URL` stitches them together in share links.

## Gotchas

- **Both instances need the same `JWT_SECRET`** only if you want sessions to be portable between
  them. They normally are not: users log in separately, and the share pages rely on tokens, not
  sessions.
- **A user registered on the public instance is stored in `content/users/`**, which is mounted
  read-only there. In practice you need a writable users directory, so either mount only
  `content/users` read-write or point the public instance at a copy. The repository's Compose mounts
  the whole content tree read-only; adjust if you enable registration at scale.
- **Unpublished songs are still unpublished.** Read-only mode does not change the published rules.
  Content must be published on the private instance before the public instance shows it.

## See also

- [Read-only mode](../reference/read-only.md)
- [Share a setlist](./share-a-setlist.md)
- [Deploy a production instance](./deploy-with-docker.md)
