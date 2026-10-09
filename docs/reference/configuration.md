# Configuration (`site.yaml`)

`content/config/site.yaml` holds app-level settings. It is created with defaults on first read if it
is missing (`src/lib/content/index.ts:521`). The schema is `SiteConfigSchema` in
`src/lib/content/schemas.ts:167`.

## Fields

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `title` | string | `Songbook` (when creating) | site title used in some outputs such as PDF |
| `defaultLanguage` | string | `en` | default language for the site |
| `pdfPageSize` | string | `A4` | page size passed to Puppeteer; `A4` or `Letter` |
| `enableArtistPages` | boolean | `true` | when false, artist routes redirect to `/songs` |
| `oidc` | object | — | OIDC configuration (optional) |
| `publicUrl` | string | — | base URL for setlist share links |

> The header brand and metadata title come from `SONGBOOK_APP_NAME`, not from `title`. `title` is a
> separate site title. See [Customise branding](../how-to/customise-branding.md).

## The `oidc` block

`OidcConfigSchema` (`src/lib/content/schemas.ts:152`):

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `enabled` | boolean | `false` | must be true to activate |
| `issuer` | string | — | provider base URL |
| `clientId` | string | — | OAuth2 client id |
| `scopes` | string[] | `[openid, profile, email]` | requested scopes |
| `roleClaim` | string | `groups` | JWT claim carrying roles/groups |
| `roleMapping` | `{ admin?, reviewer? }` | — | claim value(s) → role |
| `defaultRole` | `public` \| `reviewer` \| `admin` | `public` | fallback |
| `buttonLabel` | string | `Sign in with SSO` | login button text |
| `autoRedirect` | boolean | `false` | skip the login form |
| `logoutUrl` | string | — | provider logout endpoint |

The **client secret is not part of this schema**. It is read only from the `OIDC_CLIENT_SECRET`
environment variable.

## Environment variables override `site.yaml`

The OIDC block can be configured from env vars instead of the file, which is the recommended path
for Docker. Setting `OIDC_ISSUER` enables OIDC and merges the other `OIDC_*` values over the file
(`src/lib/content/index.ts:542`). Env vars take precedence where both express the same setting.

Not every setting has an env var. There is no env var for `pdfPageSize` or `enableArtistPages`, for
example; those are file-only. `publicUrl` does have one, `SONGBOOK_PUBLIC_URL`.

## Example

```yaml
title: Songbook
defaultLanguage: en
pdfPageSize: A4
enableArtistPages: true

# oidc:
#   enabled: true
#   issuer: https://auth.example.com/realms/main
#   clientId: songbook
#   scopes: [openid, profile, email]
#   roleClaim: groups
#   roleMapping:
#     admin: songbook-admin
#     reviewer: songbook-editor
#   defaultRole: public
#   buttonLabel: Sign in with SSO
#   autoRedirect: false
#   logoutUrl: https://auth.example.com/realms/main/protocol/openid-connect/logout
```

## See also

- [Environment variables](./environment-variables.md)
- [Authentication](./authentication.md)
- [Configure OIDC SSO](../how-to/configure-oidc-sso.md)
