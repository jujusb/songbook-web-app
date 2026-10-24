# 0018 — Setlist owner redirects to edit page

## Status

Accepted

## Date

2026-10-24

## Context

Previously, `/setlists/[setlistId]` served both the editor (for admins/reviewers) and the read-only view (for other users) on the same page. The `SetlistEditor` component was conditionally rendered inline when `showEditActions` was true (admin/reviewer), while `SetlistReadOnlyView` rendered for everyone else including the owner.

This created a confusing UX: the setlist owner (who typically has `setlist_creator` role) saw the read-only view with an "Edit" button that navigated to a non-existent `/edit` route. The owner had to click "Edit" to actually edit their setlist.

## Decision

Introduce a dedicated `/setlists/[setlistId]/edit` page that renders only the `SetlistEditor` component. On the main `/setlists/[setlistId]` page, redirect the owner (when not an admin/reviewer) to `/edit`. Admins and reviewers continue to see the inline editor on the main page. Other users (subscribers, public via share token) see the read-only view on the main page.

Routes now:

- `/setlists/[setlistId]` — read-only view for subscribers/public; inline editor for admins/reviewers; **redirects owner to `/edit`**
- `/setlists/[setlistId]/edit` — dedicated editor for owner and admins/reviewers

## Consequences

### Positive

- Clear separation: owners always land on the editor, others see the read-only view
- Dedicated edit page allows a cleaner back-link to the view page
- Consistent with `/albums/[albumId]/edit` pattern
- No more "Edit" button on the view page for owners

### Negative

- Slightly more complex routing logic in the main page
- Two server components now load similar data (setlist, songs, translations)

### Carried forward

- Admins/reviewers still see inline editor on main page (defense-in-depth: they can edit without extra navigation)
- The `SetlistEditor` component is reused unchanged

## Evidence

- `src/app/setlists/[setlistId]/page.tsx` — added redirect for owner without `showEditActions`
- `src/app/setlists/[setlistId]/edit/page.tsx` — new dedicated edit page
- `docs/reference/routes.md` — updated route table