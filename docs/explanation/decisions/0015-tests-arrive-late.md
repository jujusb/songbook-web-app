# 0015 — Tests arrive late, and cover exactly what they cover

- **Status:** Accepted — the early decisions are unpinned
- **Date:** 2026-10-09
- **Relevant code:** `vitest.config.ts`, `playwright.config.ts`, `tests/`, `github/workflows`
  (CI e2e), `src/app/**/*.test.*`

## Context

For its first ~75 commits (2026-07-08 → 2026-10-08) the project had **no automated test suite at
all**. `AGENTS.md` still says "No test suite, no formatter, no pre-commit hooks" — which was true
the day it was written and is stale today. The entire feature surface — auth, RBAC, OIDC, setlists,
publishing, revisions, Navidrome, Spotify, PDF, importers, read-only mode — shipped in that window,
verified only by manual QA.

On 2026-10-09 the missing foundation arrived in a burst: Vitest unit/component/integration/API
tests (`a2c8279`, `85d057e`, `f1096a0`), OIDC test hardening (`edeee08`), and the Playwright
e2e + CI structure (`8006052`).

## Decision

- **Unit/integration/API tests** run under Vitest with happy-dom and MSW, split into
  `tests/{unit,integration,api,components}`, with the source-adjacent `*.test.*` files organized
  under `src/app/**` when they test pages. Coverage thresholds are enforced: 70% lines, 70%
  functions, 60% branches, 70% statements.
- **E2E tests** run under Playwright (Chromium only), `baseURL` from `PLAYWRIGHT_BASE_URL`,
  targeting `NODE_ENV=production` server output; CI runs them with workers=1 because each e2e test
  mutates real content files.
- The e2e suite exercises a fresh writable instance end to end (register → login → create song →
  one-off → edit → publish → setlist → share → present).
- The suite is deliberately honest with the filesystem: e2e tests leave `content/` mutated, which is
  why `git status` on a test-run repo shows dirty content.

## Consequences

**Positive**

- The three riskiest mechanics — revisions, publishing/`published` flags, and OIDC — now have
  pinning tests, and the coverage gate stops regression on the happy paths.
- The CI runs the full build + lint + e2e per push, so the "production-grade behavior" claim is at
  least partly machine-checked.

**Negative**

- **Everything shipped before 2026-10-09 is unpinned.** The decisions in ADRs 0001–0014 were made
  and *verified by hand*; their invariants are not all captured in tests, and the coverage
  thresholds are teammates that tolerate gaps (a branch-heavy helper can hide behind 60%).
- The tests pin *some* behavior — notably the quirky bits: `Map`-to-`{}` serialization leaflets are
  absent in this codebase, but the tests do record several quirks (e.g., `?all=true`
  admin-gating, `intro`→`instrumental` normalization) the way they are, not the way they should be.
- E2E mutates content; running it against a shared mount clobbers real data, so it needs a scratch
  instance by design.

**Carried forward**

- "Green CI" should be read as "the pinned happy paths pass", not "the product is correct". The
  honest framing of that distinction is the reason this ADR is in the set at all.
- `AGENTS.md`'s "no test suite" is noted as stale there and corrected in it as part of linking the
  docs; see the repository README.

## Evidence

- `a2c8279` — chord/visual/content unit tests.
- `85d057e` — partitions/PDF/IDs/Spotify tests + coverage config.
- `f1096a0` — revision publish/revert tests (and a `lastModified` format fix that tests caught).
- `8006052` — Playwright structure + CI.
- `edeee08` — OIDC test hardening.
- How-to: [write a test](../../how-to/write-a-test.md).