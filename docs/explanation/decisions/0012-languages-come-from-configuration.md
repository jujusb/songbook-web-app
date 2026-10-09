# 0012 — Languages come from configuration, not `languages.yaml`

- **Status:** Accepted; **reverses** the plan, and the docs still mention the file
- **Date:** 2026-09-24 → 2026-10-04
- **Relevant code:** `src/lib/i18n/index.tsx`, `src/lib/i18n/labels.ts`, `src/lib/content/index.ts`,
  `docker-compose.yml`

## Context

The original design put the language list in `content/config/languages.yaml`, with display names,
RTL flags, and ordering. That file was created in the very first commit (`1ed8912`) and persisted
through the audio work. But it violates the boundary the project actually relies on: content is a
**separate, often read-only** mount, while the set of languages and the default language are
deployment facts. An operator who wants `en+es` must not have to edit a content file inside a
container image.

Commit `0a7abad` (2026-09-24) deleted the file and moved languages to environment variables.

## Decision

- `LANGUAGES` — comma-separated list of enabled language codes (default
  `en`-fallback in code, `en,es,fr` in compose).
- `LANGUAGES_DEFAULT` — the canonical/default language (code default: the first enabled language;
  `es` in compose).
- Display names come from `Intl.DisplayNames` at runtime (`src/lib/i18n/labels.ts`) — no bundled
  title per language.
- A follow-up (`82f81fe`, 2026-10-04) added a `songbook-ui-locale` cookie and language-preference
  middleware, separating *content* languages from *UI* languages once and for all.

## Consequences

**Positive**

- The composer can decide languages purely in `docker-compose.yml` — no content edits, no image
  rebuild.
- Deleting the file removed the one place where "content config" and "deployment config" collided.

**Negative**

- The removed file is still documented: `README.md` and `AGENTS.md` describe
  `content/config/languages.yaml` and reference `languages.yaml`; neither is read. Anyone following
  the README path will create a file that is silently ignored.
- Because the compose default is `es` while the code fallback is `en`, a hand-run `next dev`
  process and a compose process can disagree on the default language — a sharp edge for local
  testing against Docker.

**Carried forward**

- This is the canonical "docs drift" example in the project: specification and README describe
  something the code no longer does. The docs now say so explicitly in
  [content-model](../../explanation/content-model.md) and the reference.

## Evidence

- `0a7abad` — *"refactor language handling to use new Intl labels and remove languages.yaml"*:
  `git show 0a7abad` (the file was previously `content/config/languages.yaml`, removed with the 
  i18n refactor).
- `82f81fe` — locale-cookie middleware.
- Reference: [environment variables](../../reference/environment-variables.md).