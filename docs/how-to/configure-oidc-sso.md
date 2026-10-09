# Configure OIDC single sign-on

OIDC is optional and additive: local password login keeps working alongside it, and OIDC users are
provisioned automatically on first login. The app uses the standard Authorization Code flow with
OIDC Discovery (`/.well-known/openid-configuration`), so you only need an issuer URL, a client id,
and a client secret.

## 1. Register the callback URL with your provider

Register this redirect URI:

```
https://your-domain/api/auth/oidc/callback
```

The path is fixed. The origin comes from the request, so if you serve the app behind a proxy make
sure `X-Forwarded-Host`/`X-Forwarded-Proto` are preserved.

## 2. Set the environment variables

Setting `OIDC_ISSUER` is the trigger: if it is present, OIDC is enabled, and it overrides anything
in `site.yaml`.

```yaml
environment:
  - OIDC_ISSUER=https://auth.example.com/realms/main
  - OIDC_CLIENT_ID=songbook
  - OIDC_CLIENT_SECRET=your-client-secret
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `OIDC_ISSUER` | — | provider base URL; setting it enables OIDC |
| `OIDC_CLIENT_ID` | — | OAuth2 client id |
| `OIDC_CLIENT_SECRET` | — | OAuth2 client secret (required; never stored in `site.yaml`) |
| `OIDC_SCOPES` | `openid profile email` | space- or comma-separated scopes |
| `OIDC_ROLE_CLAIM` | `groups` | JWT claim that carries role/group values |
| `OIDC_ROLE_ADMIN` | — | claim value that maps to `admin` |
| `OIDC_ROLE_REVIEWER` | — | claim value that maps to `reviewer` |
| `OIDC_DEFAULT_ROLE` | `public` | fallback role when no mapping matches |
| `OIDC_BUTTON_LABEL` | `Sign in with SSO` | text on the login page button |
| `OIDC_AUTO_REDIRECT` | `false` | skip the login form and go straight to the provider |
| `OIDC_LOGOUT_URL` | — | provider logout endpoint |

## 3. Map roles from claims

Role resolution is deliberately simple and checked in privilege order:

1. if the configured claim matches a value in the admin mapping → `admin`,
2. otherwise if it matches the reviewer mapping → `reviewer`,
3. otherwise → `OIDC_DEFAULT_ROLE` (`public` by default).

The claim value may be a string or an array of strings; both are handled. The mapping accepts
either single values or arrays.

> **There is no OIDC mapping for `setlist_creator`.** The mapping schema only recognises `admin`
> and `reviewer`, and `defaultRole` is constrained to `public`, `reviewer`, or `admin`. If you need
> OIDC users to create setlists, either promote them to `reviewer` or create the account locally and
> adjust its role in [Manage users](./manage-users-and-roles.md).

## 4. Try it

Log out, then visit `/login`. An email/password form and a **Sign in with SSO** button are
available. Click it, authenticate at the provider, and you are redirected back to `/browse` with a
session. The first successful login creates a YAML file under `content/users/` with
`authProvider: oidc` and the mapped role, and without a `passwordHash`, so the account cannot log in
with a password.

If login fails, `/login?error=...` shows the failure and the log carries the provider's error text.

## 5. Optional behaviours

- **`OIDC_AUTO_REDIRECT=true`** sends anonymous visitors straight to the provider. Password login
  remains reachable at `/login?error=` (any error parameter disables the auto-redirect, preventing
  a loop).
- **`OIDC_LOGOUT_URL`** makes logout clear the local session and then redirect to the provider's
  logout endpoint.
- **Configure it in `site.yaml` instead.** The `oidc:` block in `content/config/site.yaml` accepts
  the same fields except the client secret. Env vars win where both are set. See
  [Configuration](../reference/configuration.md).

## Caveats

- The client secret is read **only** from `OIDC_CLIENT_SECRET`. It is never read from `site.yaml`,
  which is the file you are most likely to commit.
- Discovery results are cached for one hour per issuer.
- `verifyIdToken` checks issuer and audience against the discovered metadata; there is no separate
  nonce check beyond the `state` cookie, which is cleared after use.
- Because redirect URIs are built from the request origin, local development against a provider
  usually needs a second redirect URI registered for `http://localhost:3000/api/auth/oidc/callback`.

## See also

- [ADR-0004 — OIDC is additive](../explanation/decisions/0004-oidc-is-additive.md)
- [Authentication reference](../reference/authentication.md)
