# Authentication and access

Why authentication is a hand-rolled JWT over YAML files, why it is checked per route, and what
read-only mode does to it. The mechanics are in the [reference](../reference/authentication.md); this
page is the reasoning.

## No framework, no middleware

The app uses no auth framework. Sessions are JWTs signed with `jose`, users are YAML files, and
every route checks `getSession()` itself. This is consistent with the file-based bet (see
[ADR-0003](./decisions/0003-custom-jwt-authentication.md)) and with "self-hosted, zero external
services". It also means there is no central choke point: a new route is private only if its page
or handler adds a check. The README's claim that "there is no auth middleware" is literal — and it
has consequences, because unprotected routes are only as safe as the checks they forget.

## Four roles, one reviewer nuance

Roles are `public`, `setlist_creator`, `reviewer`, `admin`. `setlist_creator` appeared with
self-registration (commit `7685b77`, 2026-10-05) so that registered users can build setlists
without editing songs — this is what makes a campus/congregation deployment work. The reviewer
permission model (`editSong`/`editAlbum`/`editLanguage`) was added for delegating translation work,
but as the [reference](../reference/roles-and-permissions.md) documents, `canEdit(role)` ignores
permissions and most write actions do not check them. The permission lists are UI affordances, not
a security boundary.

## Admin from nowhere

There is no default user in the repo — `content/users/admin.yaml` is gitignored. `ensureDefaultAdmin`
creates `admin` from `ADMIN_PASSWORD` on the first login when no users exist. This is a deliberate
bootstrapping trick: the seed value lives in environment, the account lives in content, and neither
has to exist in the image. The consequence is that a fresh instance exposed without a password set
is admin/admin, which the [deployment guide](../how-to/deploy-with-docker.md) takes pains to warn
about.

## Read-only mode is a policy, not a flag

`SONGBOOK_READONLY=1` does not just hide buttons. It changes the auth helpers themselves
(`canEdit`, `canAdmin`, `canCreateSetlist` short-circuit), makes routes 404, and puts an
allow-list around a handful of operations. The surprising design choice is that setlist
creation/sharing and self-registration stay *on* in read-only mode, because the intended public
deployment is exactly "visitors may make their own setlists". See
[ADR-0007](./decisions/0007-read-only-mode-is-a-deployment-profile.md) and the
[read-only reference](../reference/read-only.md).

## OIDC is an enabled-by-env layer

OIDC is additive: setting `OIDC_ISSUER` enables it, and it behaves as a second way to get a
session, not as a replacement for the local model. OIDC users are provisioned into the same
`content/users/` files, marked `authProvider: oidc`, with no password hash. Role mapping is
claim-to-role and deliberately simple (admin, then reviewer, then default). What OIDC does not do
is keep roles in sync after provisioning: the role is resolved once and written to the YAML, so
provider-side role changes take effect for existing users only by re-solving (in practice: delete
or re-provision the user). See [ADR-0004](./decisions/0004-oidc-is-additive.md).

## Registration is open by default

`/register` lets anyone create a `setlist_creator` account. In deployment terms this is open
signup, which is right for a read-only public instance and wrong for a private one. There is no
invite system and no admin approval step; if you do not want open signup, disable registration or
put the instance behind your own authentication. The read-only allow-list is the only built-in
switch.

## See also

- [ADR-0003 — Custom JWT authentication](./decisions/0003-custom-jwt-authentication.md)
- [ADR-0006 — Four roles and granular permissions](./decisions/0006-four-roles-and-granular-permissions.md)
- [ADO-0007 — Read-only mode](./decisions/0007-read-only-mode-is-a-deployment-profile.md)
- [Authentication reference](../reference/authentication.md)