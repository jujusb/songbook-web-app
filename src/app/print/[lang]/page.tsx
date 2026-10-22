import {
  getLanguagesConfig,
  getSiteConfig,
} from "@/lib/content";
import { getSession, canEdit } from "@/lib/auth";
import { resolveScopeSongs } from "@/lib/export/song-scope";
import { loadPrintSongs } from "@/lib/print/load";
import { PrintPageClient } from "@/components/PrintPageClient";
import { languageLabelFor } from "@/lib/i18n/labels";

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    song?: string;
    album?: string;
    artist?: string;
    book?: string;
    refs?: string;
    langs?: string;
    repeatChorus?: string;
    showChords?: string;
    chordNotation?: string;
    orientation?: string;
    columns?: string;
    tocColumns?: string;
  }>;
}) {
  const { lang: primaryLang } = await params;
  const {
    song: songId,
    album: albumId,
    artist: artistId,
    book: bookId,
    refs: showRefsParam,
    langs: langsParam,
    repeatChorus: repeatChorusParam,
    showChords: showChordsParam,
    chordNotation: chordNotationParam,
    orientation: orientationParam,
    columns: columnsParam,
    tocColumns: tocColumnsParam,
  } = await searchParams;

  const session = await getSession();
  const isEditor = canEdit(session?.role ?? null);

  const showRefs = showRefsParam === "1" || showRefsParam === "true";
  const repeatChorus = repeatChorusParam !== "false"; // default true
  const showChords = showChordsParam !== "false"; // default true
  const chordNotation: "letters" | "solfege" | "roman" | "nashville" =
    chordNotationParam === "solfege" || chordNotationParam === "roman" || chordNotationParam === "nashville"
      ? chordNotationParam
      : "letters";
  const orientation: "portrait" | "landscape" =
    orientationParam === "landscape" ? "landscape" : "portrait";
  const columns: "1" | "2" = columnsParam === "2" ? "2" : "1";
  const tocColumns: "1" | "2" | "3" =
    tocColumnsParam === "2" || tocColumnsParam === "3" ? tocColumnsParam : "1";

  // Determine which languages to include
  let languages: string[];
  if (primaryLang === "all") {
    // All languages mode — use langs param or all configured
    if (langsParam) {
      languages = langsParam.split(",").map((l) => l.trim()).filter(Boolean);
    } else {
      const langConfig = await getLanguagesConfig();
      languages = langConfig.languages;
    }
  } else {
    // Single language mode (may include additional via langs param)
    languages = [primaryLang];
    if (langsParam) {
      const extra = langsParam.split(",").map((l) => l.trim()).filter(Boolean);
      for (const l of extra) {
        if (!languages.includes(l)) languages.push(l);
      }
    }
  }

  // Determine scope — song, album, artist, book, or full songbook
  const scope = songId ? "song" : albumId ? "album" : artistId ? "artist" : bookId ? "book" : "all";
  const scopeId = songId ?? albumId ?? artistId ?? bookId ?? null;
  const resolved = await resolveScopeSongs(scope, scopeId, { role: isEditor ? 'admin' : 'public', lang: primaryLang });

  const printSongs = await loadPrintSongs(resolved.songs, languages, showRefs, true, repeatChorus, showChords, chordNotation);

  const langLabel = languageLabelFor;

  let siteTitle = "Songbook";
  try {
    const config = await getSiteConfig();
    siteTitle = config.title;
  } catch {}

  const pageTitle = resolved.scope !== "all"
    ? `${resolved.title} — ${languages.map(langLabel).join(", ")}`
    : `${siteTitle} — ${languages.map(langLabel).join(", ")}`;

  return (
    <PrintPageClient
      printSongs={printSongs}
      pageTitle={pageTitle}
      header={
        resolved.scope !== "all" ? (
          <p className="text-neutral-500 mb-6">{resolved.title}</p>
        ) : null
      }
      showLangLabels={languages.length > 1}
      backHref={
        resolved.scope === "album" && scopeId
          ? `/albums/${scopeId}`
          : resolved.scope === "artist" && scopeId
            ? `/artists/${scopeId}`
            : resolved.scope === "song" && scopeId
              ? `/songs/${scopeId}`
              : "/print"
      }
      backLabel={
        resolved.scope === "album"
          ? "Back to Album"
          : resolved.scope === "artist"
            ? "Back to Artist"
            : resolved.scope === "song"
              ? "Back to Song"
              : "Back to Print Options"
      }
      languages={languages}
      showRefs={showRefs}
      repeatChorus={repeatChorus}
      showChords={showChords}
      chordNotation={chordNotation}
      orientation={orientation}
      columns={columns}
      tocColumns={tocColumns}
      primaryLang={primaryLang}
      emptyText="No songs found for the selected language(s)."
    />
  );
}
