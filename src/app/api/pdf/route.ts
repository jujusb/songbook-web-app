import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSetlist, getLanguagesConfig } from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canEdit, canViewSetlist } from "@/lib/auth";
import {
  generatePdfFromUrl,
  extractSessionCookie,
  safePdfFilename,
} from "@/lib/pdf";

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

  // The headless browser cannot carry the caller's cookies, so access for
  // private setlists travels via the share token; editor-only access (no
  // token yet) is bridged by forwarding the session cookie to the loopback
  // request.
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