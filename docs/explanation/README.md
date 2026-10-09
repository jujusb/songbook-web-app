# Explanation

Explanation answers *why*. It is for reading when you want to understand a decision, not to
accomplish a task.

If you want to **do** something, use the [tutorials](../tutorials/README.md) or the
[how-to guides](../how-to/README.md). If you want to **look something up**, use the
[reference](../reference/README.md).

## How this section is sourced

Every architectural decision is written as an ADR in [decisions/](./decisions/README.md) with:

- **Context** — the situation that made a decision necessary, with the dates and commits that
  establish it.
- **Decision** — what was chosen, and where in the code you can read it today.
- **Consequences** — what it cost. Including the parts that turned out badly, because those are
  the parts you cannot rediscover by reading the code.
- **Evidence** — the commits, so you can check them (`git show <hash>` works).

The commits are real and dated. Where the history shows a decision being made and then partly
undone, the ADR says so and links the reversal.

## The shape of the system

| Page | Covers |
| --- | --- |
| [Architecture](./architecture.md) | The layers, the request path, and why each layer exists |
| [Content model](./content-model.md) | Why a song is a folder, what is shared and what is per-language |
| [Authentication and access](./authentication.md) | The session model, the roles, read-only mode, and OIDC |

## Decisions

[decisions/README.md](./decisions/README.md) — the ADR index, covering the content model, the auth
model, sharing, publishing, integrations, and one feature that was removed.

## Things worth knowing before you read any of it

- **The history is short and dominated by a few authors.** The first commit is dated
  `2026-07-08`; almost the entire app landed in roughly three months. The commit log is readable
  as a single continuous build rather than a series of handovers.
- **The design spec and the code have drifted.** `songbook-web-app.md` at the repository root is
  the original plan, and some of it was never built or was later changed — the planned
  `content/songs/` layout and `languages.yaml` are gone, and a database-less, props-driven app
  replaced several of the sketched modules. Where that matters, the ADR says so rather than
  implying continuity.
- **The docs were written after the fact.** These pages were assembled by reading the code and the
  commit log, not by the original authors narrating their intent. Where the intent cannot be
  recovered from the history, the record says "the history does not say" instead of guessing.
