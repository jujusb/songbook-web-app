# Write or run the tests

The project has two test layers: fast Vitest tests for libraries, routes and components, and
Playwright end-to-end tests against a running server. This guide explains where tests live, how to
run them, and the conventions to follow.

## Commands

| Command | Runs |
| --- | --- |
| `npm test` | Vitest once (`vitest run`) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with V8 coverage and thresholds |
| `npm run test:ui` | the Vitest UI |
| `npm run test:e2e` | Playwright |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:all` | coverage, then e2e |

## Where tests live

```
tests/
  unit/lib/**/*.test.ts        pure library tests
  integration/api/**/*.test.ts API route handlers, request in / response out
  components/**/*.test.tsx     React components with Testing Library
  e2e/*.spec.ts                Playwright
  fixtures/                    sample content and inputs
  mocks/                       MSW handlers and stubs
  setup/vitest.setup.ts        global setup (MSW server, env stubs)
```

Vitest is configured with `happy-dom`, `globals: true`, a `@` alias to `src`, and a single fork.
The setup file starts an MSW server that fails on unhandled requests, stubs `next/headers`, and
pins `JWT_SECRET`, `ADMIN_PASSWORD`, `NODE_ENV`, and `SONGBOOK_READONLY`. Declare each test's
network calls in `tests/mocks/handlers.ts` or override with `server.use(...)`.

## Coverage

`npm run test:coverage` enforces thresholds of 70% lines, 70% functions, 60% branches, and 70%
statements, measured over `src/lib/**` and `src/app/api/**`. Pages and components are excluded from
coverage by design; component tests still run.

## Unit tests

Import the module directly:

```ts
import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/...';

describe('slugify', () => {
  it('lowercases and replaces spaces', () => {
    expect(slugify('Amazing Grace')).toBe('amazing-grace');
  });
});
```

Keep the filesystem out of unit tests when you can; when a function reads a content file, write a
fixture into a temp directory and point the module's env at it.

## API tests

Call the route handler's exported `GET`/`POST`/… with a `Request`, and assert on the returned
`Response`. Session-dependent routes are exercised by stubbing the session cookie or the `cookies`
mock. See `tests/integration/api/*.test.ts` for the established patterns.

## End-to-end tests

`tests/e2e/critical-flows.spec.ts` drives the real app through a browser. The config starts a
production server itself (`npm run start`) unless `PLAYWRIGHT_BASE_URL` is set, in which case it
targets an already-running server. Helper functions live in `tests/e2e/support.ts`
(`loginAsAdmin`, `submitLogin`, `cleanup`).

> The e2e suite writes to the content directory, so it is serial in CI (`workers: 1`) and should be
> pointed at a disposable copy of `content/`, not your real library.

Run only Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

The project runs Chromium only. WebKit rejects the `Secure` session cookie over plain HTTP, and
narrow-screen behaviour is covered by an explicit viewport test rather than a separate device
project.

## When you add a feature

1. Add or extend a Vitest test for the library or route behaviour.
2. If the feature is a user-visible flow, add a step to the matching Playwright spec.
3. Run `npm run lint` and `npx tsc --noEmit`.
4. Run `npm test` and, if you touched a flow, `npm run test:e2e`.

## See also

- [Architecture](../explanation/architecture.md)
- [ADR-0015 — Tests arrive late](../explanation/decisions/0015-tests-arrive-late.md)
