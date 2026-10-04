import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getLanguagesConfig,
  getSetlist,
} from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canEdit, canViewSetlist } from "@/lib/auth";
import { resolveScopeSongs, type ExportScope } from "@/lib/export/song-scope";
import { loadPartitionPdf } from "@/lib/pdf/partitions";
import {
  generatePdfFromUrl,
  extractSessionCookie,
  safePdfFilename,
  mergePdfBuffers,
} from "@/lib/pdf";
import { languageLabelFor } from "@/lib/i18n/labels";

// --- Shared helpers -------------------------------------------------------

function baseUrl(): string {
  const port = process.env.PORT || 3000;
  return `http://127.0.0.1:${port}`;
}

/**
 * Build the printable chords URL for a scope. Non-setlist scopes land on the
 * songbook print page; setlists land on the setlist print page (which carries
 * its own access guard via `?share` and the forwarded session cookie).
 */
function buildChordsPrintUrl({
  scope,
  id,
  share,
  lang,
  langs,
  refs,
}: {
  scope: string;
  id: string | null;
  share?: string;
  lang: string;
  langs: string[];
  refs: boolean;
}): string {
  const params = new URLSearchParams();
  if (scope === "setlist" && id) {
    return (
      `${baseUrl()}/setlists/${encodeURIComponent(id)}/print` +
      `?lang=${encodeURIComponent(lang)}` +
      (share ? `&share=${encodeURIComponent(share)}` : "")
    );
  }
  if (scope === "album" && id) params.set("album", id);
  if (scope === "artist" && id) params.set("artist", id);
  if (scope === "song" && id) params.set("song", id);
  if (scope === "book" && id) params.set("book", id);
  if (refs) params.set("refs", "1");
  if (langs.length === 1) {
    const qs = params.toString();
    return `${baseUrl()}/print/${encodeURIComponent(langs[0])}${qs ? `?${qs}` : ""}`;
  }
  params.set("langs", langs.join(","));
  const qs = params.toString();
  return `${baseUrl()}/print/all${qs ? `?${qs}` : ""}`;
}

interface ChordsRequest {
  type: "chords";
  scope: string;
  id?: string | null;
  share?: string | null;
  lang?: string | null;
  langs?: string[] | null;
  refs?: boolean | null;
}

interface InstrumentalRequest {
  type: "instrumental";
  scope: string;
  id?: string | null;
  share?: string | null;
  instrument?: string | null;
  files?: string[] | null;
}

type PdfRequest = ChordsRequest | InstrumentalRequest;

// --- POST: generic convert-to-PDF ---------------------------------------

export async function POST(request: Request) {
  let body: PdfRequest;
  try {
    body = (await request.json()) as PdfRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const langConfig = await getLanguagesConfig();

  if (body.type === "chords") {
    const langs = normalizeLangs(
      body.lang ?? langConfig.default,
      body.langs ?? [],
      langConfig,
    );
    return handleChords(body, langs, langConfig, request);
  }

  if (body.type === "instrumental") {
    return handleInstrumental(body);
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}

function normalizeLangs(
  primary: string,
  extra: string[],
  langConfig: { languages: string[]; default: string },
): string[] {
  const valid = (l: string) =>
    l === langConfig.default || langConfig.languages.includes(l);
  const langs: string[] = [];
  const push = (l: string) => {
    const ll = l.trim();
    if (ll && valid(ll) && !langs.includes(ll)) langs.push(ll);
  };
  push(primary);
  for (const l of extra) push(l);
  if (langs.length === 0) langs.push(langConfig.default);
  return langs;
}

async function assertSetlistViewable(
  scope: string,
  id: string | null,
  share: string | null,
): Promise<string | null> {
  if (scope !== "setlist" || !id) return null;
  const setlist = await getSetlist(id).catch(() => null);
  if (!setlist) return "Setlist not found";
  const session = await getSession();
  const isEditor = canEdit(session?.role ?? null);
  if (!canViewSetlist(setlist, share ?? undefined, isEditor)) {
    return "Setlist not found";
  }
  return null;
}

async function handleChords(
  body: ChordsRequest,
  langs: string[],
  langConfig: { languages: string[]; default: string },
  request: Request,
): Promise<NextResponse> {
  const accessError = await assertSetlistViewable(
    body.scope,
    body.id ?? null,
    body.share ?? null,
  );
  if (accessError) {
    return NextResponse.json({ error: accessError }, { status: 404 });
  }

  const resolved = await resolveScopeSongs(
    body.scope as ExportScope,
    body.id ?? null,
  );
  if (!resolved || resolved.songs.length === 0) {
    return NextResponse.json(
      { error: "No songs in the selected scope" },
      { status: 400 },
    );
  }

  const refs = !!body.refs;
  const url = buildChordsPrintUrl({
    scope: body.scope,
    id: body.id ?? null,
    share: body.share ?? undefined,
    lang: body.lang ?? langConfig.default,
    langs,
    refs,
  });

  try {
    const pdf = await generatePdfFromUrl(
      url,
      extractSessionCookie(request.headers.get("cookie")),
    );
    const langLabel = langs.map(languageLabelFor).join("-");
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safePdfFilename(
          `${resolved.title} ${langLabel}`,
        )}.pdf"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleInstrumental(
  body: InstrumentalRequest,
): Promise<NextResponse> {
  const accessError = await assertSetlistViewable(
    body.scope,
    body.id ?? null,
    body.share ?? null,
  );
  if (accessError) {
    return NextResponse.json({ error: accessError }, { status: 404 });
  }

  const resolved = await resolveScopeSongs(
    body.scope as ExportScope,
    body.id ?? null,
  );
  if (!resolved) {
    return NextResponse.json({ error: "Scope not found" }, { status: 404 });
  }

  const instrument = body.instrument ?? null;
  const allowed = new Map<string, { title: string; instrument: string }>();
  let instrumentLabel: string | null = null;
  for (const songEnt of resolved.songs) {
    for (const part of songEnt.meta?.partitions ?? []) {
      if (instrument && part.instrument !== instrument) continue;
      if (!instrumentLabel) {
        instrumentLabel = part.instrumentLabel ?? part.instrument;
      }
      allowed.set(part.file, {
        title: part.title ?? part.file,
        instrument: part.instrumentLabel ?? part.instrument,
      });
    }
  }

  if (allowed.size === 0) {
    return NextResponse.json(
      { error: "No partitions in the selected scope" },
      { status: 400 },
    );
  }

  // If the caller selected a subset of files, intersect with the allowed set
  // (never trust arbitrary paths). No files → all allowed files of the scope.
  const wanted =
    body.files && body.files.length > 0
      ? body.files.filter((f) => allowed.has(f))
      : [...allowed.keys()];

  const buffers: Uint8Array[] = [];
  for (const file of wanted) {
    const buf = await loadPartitionPdf(file);
    if (buf) buffers.push(buf);
  }

  if (buffers.length === 0) {
    return NextResponse.json(
      { error: "No readable partitions in the selection" },
      { status: 400 },
    );
  }

  try {
    const merged = await mergePdfBuffers(buffers);
    const label = instrumentLabel ?? (instrument ?? "instrumental");
    const filename = safePdfFilename(`${resolved.title} ${label}`);
    return new NextResponse(merged as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to merge PDFs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// --- GET: legacy setlist download (kept for API compatibility) -----------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const setlistId = searchParams.get("setlist");
  if (!setlistId) {
    return NextResponse.json(
      { error: "setlist parameter is required" },
      { status: 400 }
    );
  }

  let setlist;
  try {
    setlist = await getSetlist(setlistId);
  } catch {
    return NextResponse.json({ error: "Setlist not found" }, { status: 404 });
  }

  const session = await getSession();
  const isEditor = canEdit(session?.role ?? null);
  const shareParam = searchParams.get("share") ?? undefined;
  if (!canViewSetlist(setlist, shareParam, isEditor)) {
    return NextResponse.json({ error: "Setlist not found" }, { status: 404 });
  }

  const langConfig = await getLanguagesConfig();
  const selectedLang = getLocale(await cookies(), langConfig.default);

  const port = process.env.PORT || 3000;
  const printUrl =
    `http://127.0.0.1:${port}/setlists/${encodeURIComponent(setlist.id)}/print` +
    `?lang=${encodeURIComponent(selectedLang)}` +
    (setlist.shareToken
      ? `&share=${encodeURIComponent(setlist.shareToken)}`
      : "");

  try {
    const pdf = await generatePdfFromUrl(
      printUrl,
      extractSessionCookie(request.headers.get("cookie"))
    );
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safePdfFilename(
          setlist.title
        )}.pdf"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}