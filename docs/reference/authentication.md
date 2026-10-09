# Authentication

The app uses a custom JWT session, not NextAuth. Users are YAML files, passwords are bcrypt hashes,
and the session is an HTTP-only cookie. Optional OIDC is layered on top. The implementation is in
`src/lib/auth/index.ts` (sessions, users) and `src/lib/auth/oidc.ts` (OIDC).

## The session

| Property | Value | Location |
| --- | --- | --- |
| Cookie name | `songbook-session` | `src/lib/auth/index.ts:13` |
| Algorithm | HS256 | `:147` |
| Expiry | 7 days | `:148` |
| Payload | `{ userId, role }` | `:146` |
| Cookie flags | `httpOnly`, `sameSite: lax`, `path: /`, `secure` when `NODE_ENV=production` | login route `:31` |
| Secret | `JWT_SECRET`, default `songbook-default-secret-change-me` | `:10` |

`createSession(userId, role)` signs the JWT and sets the cookie; `getSession()` verifies it and
returns `{ userId, role }` or null. `getCurrentUser()` reads the session and loads the user file.
There is no server-side session store, so a role change takes effect for new requests only after
the token is reissued (for example, by logging in again).

## Users

`UserSchema` (`src/lib/auth/schemas.ts:17`): `id`, `username`, `passwordHash` (absent for OIDC),
`role`, optional `displayName`/`email`, `authProvider` (`local`/`oidc`), optional `oidcSub`,
`created`, optional `permissions`, and optional `voice` (one of `tenor`/`bass`/`alto`/`soprano`).
Users are stored in `content/users/<id>.yaml`.

`listUsers`, `getUser`, `createUser`, `saveUser`, and `deleteUser` live in `src/lib/auth/index.ts`.
Passwords are hashed with bcrypt (`bcryptjs`). A logged-in user can set their own `voice` on
`/profile` (`src/app/actions.ts` `updateMyVoicePreferenceAction`); it is selected by default in the
song-page players and setlist voice playlists.

### The default admin

`ensureDefaultAdmin()` (`:211`) runs from the login route. If no users exist and read-only mode is
not blocking `user_write`, it creates `admin` with the `ADMIN_PASSWORD` env value (default `admin`)
and role `admin`. This is why the first login on a fresh instance works even though no account was
created ahead of time.

## Routes

| Method + path | Purpose | Notes |
| --- | --- | --- |
| `POST /api/auth/login` | password login | body `{username, password}`; sets the cookie; seeds the default admin |
| `POST /api/auth/logout` | clear the session | may return `{redirectUrl}` for OIDC provider logout |
| `GET /api/auth/me` | current user | returns `{user: null}` in read-only mode |
| `POST /api/auth/register` | self-registration | password ≥ 8 chars, username ≥ 3; assigns `setlist_creator` |
| `GET /api/auth/oidc` | start OIDC | 302 to the provider; sets a 10-minute `oidc-state` cookie |
| `GET /api/auth/oidc/callback` | finish OIDC | verifies state, exchanges code, auto-provisions the user |

Login, logout, and register are the operations read-only mode permits; the `isReadOnlyFor(...)`
guards on those routes are therefore inert. See [Read-only mode](./read-only.md).

## OIDC

`getOidcConfig()` reads the `oidc` block from `site.yaml`, which env vars override. The flow:

1. `/api/auth/oidc` builds the authorization URL from OIDC Discovery
   (`<issuer>/.well-known/openid-configuration`, cached one hour) and stores a random `state` in a
   cookie.
2. The provider redirects back to `/api/auth/oidc/callback?code=...&state=...`.
3. `exchangeCode` posts the code to the token endpoint; `verifyIdToken` checks the id token's
   issuer and audience against the discovered JWKS.
4. `resolveRole` maps the configured claim to a role: admin mapping first, then reviewer, then
   `defaultRole`.
5. The user is found or created by `oidcSub`, with `authProvider: oidc` and no password hash.

The client secret is read only from `OIDC_CLIENT_SECRET`. Role mapping supports `admin` and
`reviewer` values only; `defaultRole` is limited to `public`, `reviewer`, or `admin`. There is no
OIDC mapping for `setlist_creator`.

## See also

- [Roles and permissions](./roles-and-permissions.md)
- [Configure OIDC SSO](../how-to/configure-oidc-sso.md)
- [ADR-0003 — Custom JWT authentication](../explanation/decisions/0003-custom-jwt-authentication.md)
- [ADR-0004 — OIDC is additive](../explanation/decisions/0004-oidc-is-additive.md)
