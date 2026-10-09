# 0013 — PDFs are printed by Chromium from the app's own print route

- **Status:** Accepted
- **Date:** 2026-09-21 → 2026-09-24
- **Relevant code:** `src/lib/pdf/index.ts`, `src/app/print/[lang]/page.tsx`, `src/app/api/pdf`,
  `Dockerfile` (Chromium + Noto fonts, `PUPPETEER_EXECUTABLE_PATH`)

## Context

The classic approach — a server-side PDF library composing tables — would reproduce the entire
visual identity (chords over lyrics, section layout, fonts, language switching) twice. The app
already had a fully styled, server-rendered print route. Printing *that* keeps PDF and screen
rendering from drifting.

The first PDF export (`7104557`, 2026-09-21, album/artist PDFs) used this printing approach, and
the setlist/songbook PDFs (`3cb9b15` + `fdd1fac`, 2026-09-24) extended it.

## Decision

- The PDF generator launches Puppeteer, navigates to the app's own `/print/...` and setlist print
  pages (with query params configuring scope, language, references, `repeatChorus`), and calls
  `page.pdf()`.
- Because the browser must run inside the container, the production `Dockerfile` installs
  Chromium and Noto fonts and sets `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` with
  `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
- `/api/pdf` accepts scope/id/share params, validates them, and intercepts the partition-file
  list before rendering; it 500s if the render fails so the caller can distinguish empty-scope
  (400) from a real failure.

## Consequences

**Positive**

- PDFs are pixel-faithful: what you see printed is what you see on screen, fonts and all.
- ANY improvement to the print CSS improves the PDF for free.

**Negative**

- The production image ships a full headless browser (~hundreds of MB) and its font stack — the
  largest single thing in the image.
- PDF rendering is a browser boot per request: slow-ish, and it needs a writable `~/.cache`
  (puppeteer cache) in the container unless configured.
- The print routes are themselves public pages, so the render surface the browser reads is the same
  public surface — no secrets ride along, but the route must stay valid for anonymous users.

**Carried forward**

- Chromium must remain installable in the image (build-time apt) — removing Puppeteer would save the
  biggest image cost but is not planned.

## Evidence

- `7104557` — first album/artist PDF export.
- `3cb9b15` — Puppeteer setlist PDFs; `fdd1fac` — PDF songbooks.
- How-to: [export a PDF](../../how-to/export-a-pdf.md).