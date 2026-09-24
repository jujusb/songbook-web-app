import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getAlbum, getAlbumTitle, getArtist, getSong, getSongTranslations, getSongTitle, getLanguagesConfig, shouldShowSongInLanguage } from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { languageLabelFor } from "@/lib/i18n/labels";
import { getSession, canEdit, canAdmin } from "@/lib/auth";
import { DeleteButton } from "@/components/DeleteButton";
import { NavidromeShareButton } from "@/components/NavidromeShareButton";
import { getNavidromeConfig } from "@/lib/navidrome/config";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";

export default async function AlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { albumId } = await params;
  const { lang } = await searchParams;
  const cookieStore = await cookies();
  const langConfig = await getLanguagesConfig();
  const uiLocale = getLocale(cookieStore, langConfig.default);
  const langLabel = languageLabelFor;
  const displayLang = lang || uiLocale;

  let album;
  try {
    album = await getAlbum(albumId);
  } catch {
    notFound();
  }

  // Load song metadata for each song in the album (in order)
  const songs = await Promise.all(
    album.songs.map(async (songId) => {
      try {
        const song = await getSong(songId);
        const translations = await getSongTranslations(songId);
        if (!shouldShowSongInLanguage(translations, displayLang, langConfig.default)) {
          return null;
        }
        const localizedTitle = displayLang ? await getSongTitle(songId, displayLang) : song.title;
        return { ...song, title: localizedTitle, translations };
      } catch {
        return null;
      }
    })
  );

  const validSongs = songs.filter(Boolean);

  const localizedAlbumTitle = displayLang ? await getAlbumTitle(albumId, displayLang) : album.title;

  let artistName = album.artist;
  try {
    const artistData = await getArtist(album.artist);
    artistName = artistData.name;
  } catch {}

  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);
  const showDeleteActions = canAdmin(session?.role ?? null);
  const navidromeEnabled = getNavidromeConfig() !== null;
  const isOriginalLanguage = displayLang === langConfig.default;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Album header */}
      <div className="mb-8">
        <Link
          href="/albums"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block"
        >
          &larr; All Albums
        </Link>
        <h1 className="text-3xl font-bold">{localizedAlbumTitle}</h1>
        <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500">
          <Link
            href={`/artists/${album.artist}?lang=${displayLang}`}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {artistName}
          </Link>
          {album.year && (
            <>
              <span>&middot;</span>
              <span>{album.year}</span>
            </>
          )}
          <span>&middot;</span>
          <span>
            {validSongs.length} song{validSongs.length !== 1 ? "s" : ""}
          </span>
        </div>
        {album.description && (
          <p className="mt-3 text-neutral-600 dark:text-neutral-400 max-w-2xl">
            {album.description}
          </p>
        )}
        {album.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {album.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-600 dark:text-neutral-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          {showEditActions && (
            <Link
              href={`/albums/${albumId}/edit`}
              className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Edit Album
            </Link>
          )}
          <Link
            href={`/print?album=${albumId}`}
            className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Export PDF for this Album
          </Link>
          {isOriginalLanguage ? (
            <SpotifyPlayer
              type="album"
              id={albumId}
              lang={displayLang}
              explicitUrl={album.spotify ?? null}
              title={localizedAlbumTitle}
              artist={artistName}
            />
          ) : null}
          {showEditActions && (
            <Link
              href={`/songs/new?album=${albumId}`}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              + Add Song
            </Link>
          )}
          {showDeleteActions && (
            <DeleteButton
              apiEndpoint="/api/albums"
              id={albumId}
              label={album.title}
              redirectTo="/browse"
            />
          )}
        </div>
      </div>

      {/* Song list */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Tracklist
          </span>
        </div>
        {validSongs.length === 0 ? (
          <div className="p-4 text-neutral-500 text-sm">
            No songs in this album yet.
          </div>
        ) : (
          <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {validSongs.map((song, index) => (
              song && (
                <li
                  key={song.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                >
                  <Link
                    href={`/songs/${song.id}?lang=${displayLang}`}
                    className="flex items-center gap-4 flex-1 min-w-0"
                  >
                    <span className="text-sm text-neutral-400 w-8 text-right font-mono">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{song.title}</span>
                      {song.key && (
                        <span className="ml-2 text-xs text-neutral-400">
                          {song.key}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {song.translations.map((lang: string) => (
                        <span
                          key={lang}
                          className="text-xs px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-500"
                        >
                          {langLabel(lang)}
                        </span>
                      ))}
                    </div>
                    {song.tags.length > 0 && (
                      <div className="hidden sm:flex gap-1">
                        {song.tags.slice(0, 3).map((tag: string) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                  {(() => {
                    if (isOriginalLanguage) {
                      return (
                        <SpotifyPlayer
                          variant="compact"
                          type="track"
                          id={song.id}
                          lang={displayLang}
                          explicitUrl={song.spotify?.song ?? null}
                          title={song.title}
                          artist={artistName}
                        />
                      );
                    }
                    return navidromeEnabled ? (
                      <NavidromeShareButton
                        key={`${song.id}:${displayLang}`}
                        variant="compact"
                        type="song"
                        id={song.id}
                        lang={displayLang}
                      />
                    ) : null;
                  })()}
                </li>
              )
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
