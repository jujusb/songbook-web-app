import {
  getLanguagesConfig,
  getSiteConfig,
} from "@/lib/content";
import { resolveScopeSongs } from "@/lib/export/song-scope";
import { loadPrintSongs } from "@/lib/print/load";
import { PrintSongbook } from "@/components/PrintSongbook";
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
    refs?: string;
    langs?: string;
  }>;
}) {
  const { lang: primaryLang } = await params;
  const {
    song: songId,
    album: albumId,
    artist: artistId,
    refs: showRefsParam,
    langs: langsParam,
  } = await searchParams;

  const showRefs = showRefsParam === "1" || showRefsParam === "true";

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

  // Determine scope — song, album, artist, or full songbook
  const scope = songId ? "song" : albumId ? "album" : artistId ? "artist" : "all";
  const scopeId = songId ?? albumId ?? artistId ?? null;
  const resolved = await resolveScopeSongs(scope, scopeId);

  const printSongs = await loadPrintSongs(resolved.songs, languages, showRefs);

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
    <PrintSongbook
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
      toolbarChildren={
        <span className="text-sm text-neutral-500">
          {printSongs.length} song{printSongs.length !== 1 ? "s" : ""}
          {" · "}
          {languages.map(langLabel).join(", ")}
          {showRefs && " · with references"}
        </span>
      }
      emptyText="No songs found for the selected language(s)."
    />
  );
}