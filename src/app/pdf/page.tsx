import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  listAlbums,
  listArtists,
  listSongs,
  listSetlists,
  getSetlist,
  getSiteConfig,
  getLanguagesConfig,
} from "@/lib/content";
import { getLocale, createT } from "@/lib/i18n/server";
import { getSession, canEdit, canViewSetlist } from "@/lib/auth";
import { resolveScopeSongs } from "@/lib/export/song-scope";
import { planSongbookChapters } from "@/lib/print/load";
import { resolveSongListTitle } from "@/lib/song-titles";
import { partitionInstrumentOf } from "@/lib/partitions";
import { PdfExportView } from "@/components/PdfExportView";
import type { ScopeOption, InstrumentalFile, ViewerSong } from "@/components/PdfExportView";

export const dynamic = "force-dynamic";

export default async function PdfPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (key: string): string | undefined => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const langConfig = await getLanguagesConfig();
  const locale = getLocale(await cookies(), langConfig.default);
  const t = createT(locale);

  const type = get("type") === "instrumental" ? "instrumental" : "chords";
  const rawScope = get("scope") ?? "all";
  const scope =
    rawScope === "album" || rawScope === "artist" || rawScope === "song" || rawScope === "setlist"
      ? rawScope
      : "all";
  const id = get("id") ?? null;
  const share = get("share") ?? null;

  const primaryLang = get("lang") ?? locale;
  const requestedLangs = [
    primaryLang,
    ...(get("langs") ?? "").split(",").map((l) => l.trim()).filter(Boolean),
  ].filter((l) => l && (l === langConfig.default || langConfig.languages.includes(l)));
  const langs = requestedLangs.length > 0 ? requestedLangs : [langConfig.default];
  const includeRefs = get("refs") === "1";
  const rawInstrument = get("instrument") ?? null;

  // --- Setlist access guard (covers the setlist scope) -------------------
  if (scope === "setlist" && id) {
    const setlist = await getSetlist(id).catch(() => null);
    const session = await getSession();
    const isEditor = canEdit(session?.role ?? null);
    if (!setlist || !canViewSetlist(setlist, share ?? undefined, isEditor)) {
      notFound();
    }
  }

  // --- Scope options for the selector ------------------------------------
  const [albumsData, artistsData, songsData, setlistsData] = await Promise.all([
    listAlbums(),
    listArtists(),
    listSongs(),
    listSetlists(),
  ]);
  const artistName = new Map(artistsData.map((a) => [a.id, a.name] as [string, string]));
  const albums: ScopeOption[] = albumsData.map((a) => ({
    id: a.id,
    title: a.title,
    meta: `${artistName.get(a.artist) || a.artist} · ${a.songs.length}`,
  }));
  const artists: ScopeOption[] = artistsData.map((a) => ({ id: a.id, title: a.name }));
  const songs: ScopeOption[] = songsData.map((s) => ({ id: s.id, title: s.title }));
  const session = await getSession();
  const isEditor = canEdit(session?.role ?? null);
  const setlists: ScopeOption[] = [];
  for (const s of setlistsData) {
    if (canViewSetlist(s, share ?? undefined, isEditor)) {
      setlists.push({ id: s.id, title: s.title, meta: s.date ?? undefined });
    }
  }

  // For the chords type, the song/album/artist lists must only contain entries
  // that actually have a translation in one of the selected languages, so the
  // user can't pick a song/album/artist with no content in that language.
  if (type === "chords") {
    const songHasLang = (s: (typeof songsData)[number]) =>
      s.translations.some((l) => langs.includes(l));
    const filteredSongIds = new Set(songsData.filter(songHasLang).map((s) => s.id));

    const albumHasLang = (a: (typeof albumsData)[number]) =>
      a.songs.some((id) => filteredSongIds.has(id));
    const artistHasLang = (ar: (typeof artistsData)[number]) =>
      albumsData.some((a) => a.artist === ar.id && albumHasLang(a));

    const albumsFiltered: ScopeOption[] = albumsData.filter(albumHasLang).map((a) => ({
      id: a.id,
      title: a.titles?.[langs[0]] || a.title,
      meta: `${artistName.get(a.artist) || a.artist} · ${a.songs.length}`,
    }));
    const songsFiltered: ScopeOption[] = songsData.filter(songHasLang).map((s) => ({
      id: s.id,
      title: resolveSongListTitle(s, langs[0]),
    }));
    const artistsFiltered: ScopeOption[] = artistsData.filter(artistHasLang).map((a) => ({
      id: a.id,
      title: a.name,
    }));

    albums.length = 0;
    songs.length = 0;
    artists.length = 0;
    albums.push(...albumsFiltered);
    songs.push(...songsFiltered);
    artists.push(...artistsFiltered);
  }

  // --- Resolve the current scope -----------------------------------------
  const resolved = await resolveScopeSongs(scope, id);

  // Viewer data
  let viewerSongs: ViewerSong[] = [];
  let instruments: { slug: string; label: string }[] = [];
  let instrumentalFiles: InstrumentalFile[] = [];

  if (type === "chords") {
    viewerSongs = await planSongbookChapters(resolved.songs, langs);
  } else {
    // Instruments available within the scope come from the partitions applied
    // to the scope's songs (the same set the PDF merge honours).
    const instrumentSet = new Map<string, string>();
    for (const songEnt of resolved.songs) {
      for (const part of songEnt.meta?.partitions ?? []) {
        if (!instrumentSet.has(part.instrument)) {
          instrumentSet.set(part.instrument, part.instrumentLabel ?? part.instrument);
        }
      }
    }
    instruments = [...instrumentSet.entries()].map(([slug, label]) => ({ slug, label }));

    const selectedInstrument =
      rawInstrument && instrumentSet.has(rawInstrument)
        ? rawInstrument
        : instruments[0]?.slug ?? null;

    if (selectedInstrument) {
      const files: InstrumentalFile[] = [];
      for (const songEnt of resolved.songs) {
        const songTitle = songEnt.meta?.title ?? songEnt.songId;
        for (const part of songEnt.meta?.partitions ?? []) {
          if (part.instrument !== selectedInstrument) continue;
          const parsed = partitionInstrumentOf(part);
          files.push({
            file: part.file,
            title:
              parsed.label !== (part.instrumentLabel ?? part.instrument)
                ? `${parsed.label} — ${part.title ?? part.file}`
                : (part.title ?? part.file),
            songTitle,
          });
        }
      }
      instrumentalFiles = files;
    }
  }

  const selectedForViewer = instruments.some((i) => i.slug === rawInstrument)
    ? (rawInstrument as string)
    : instruments[0]?.slug ?? undefined;

  let siteTitle = "Songbook";
  try {
    const config = await getSiteConfig();
    siteTitle = config.title;
  } catch {}
  const scopeTitle = scope === "all" ? siteTitle : resolved.title;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{t("pdf.title")}</h1>
      <p className="text-sm text-neutral-500 mb-6">{scopeTitle}</p>
      <PdfExportView
        key={`${type}-${scope}-${id ?? ""}-${selectedForViewer}`}
        type={type}
        scope={scope}
        id={id ?? ""}
        share={share ?? undefined}
        scopeLocked={scope === "setlist" && share !== null}
        instruments={instruments}
        selectedInstrument={selectedForViewer}
        instrumentalFiles={instrumentalFiles}
        viewerSongs={viewerSongs}
        albums={albums}
        artists={artists}
        songs={songs}
        setlists={setlists}
        languages={langConfig.languages}
        selectedLangs={langs}
        includeRefs={includeRefs}
        canExport={type === "chords" ? viewerSongs.length > 0 : instrumentalFiles.length > 0}
      />
    </div>
  );
}