# Tutorials

A tutorial is a **lesson**. It is written for somebody who has just self-hosted the app and does
not know its content model yet. It deliberately gets something working first and explains only
what you need to keep going. Read it start to finish, top to bottom, without skipping.

If you already know the app and want to accomplish one task, use the
[how-to guides](../how-to/README.md). If you want to look something up, use the
[reference](../reference/README.md). If you want to know *why* something works the way it does,
read the [explanation](../explanation/README.md).

## Available tutorials

| Tutorial | You will | Time |
| --- | --- | --- |
| [1. Your first song](./01-first-song.md) | Run the app, log in, read a song, and find the files on disk | 15 min |
| [2. Add a translation and publish it](./02-add-a-translation.md) | Add a Spanish version to a song, edit it, and make both translations visible | 20 min |
| [3. Build and share a setlist](./03-build-and-share-a-setlist.md) | Order songs into a setlist, present it, export it, and hand out a share link | 20 min |

## Before you start

All three tutorials assume:

- a running instance. `docker compose up` for development, or the production image via `./run.sh`.
  The tutorial text uses `http://localhost:3000`, which is where the Compose service publishes the
  app by default.
- a `content/` folder. The repository ships one, and Docker bind-mounts it into the container so
  every change you make in the UI is visible on disk under `content/`.
- the default admin credentials, unless you set `ADMIN_PASSWORD` when you started the app:
  user `admin`, password `admin`.

If you have not started the app yet, do [Run it locally](../how-to/run-it-locally.md) first, then
come back.
