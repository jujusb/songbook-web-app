import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getArtist,
  getAlbumsForArtist,
  getSiteConfig,
  getSong,
  getSongTranslations,
  getSongTitle,
  getLanguagesConfig,
  shouldShowSongInLanguage,
} from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canAdmin } from "@/lib/auth";
import { DeleteButton } from "@/components/DeleteButton";
import { T } from "@/components/Translate";

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const config = await getSiteConfig();
  if (!config.enableArtistPages) {
    redirect("/songs");
  }

  const { artistId } = await params;
  const cookieStore = await cookies();
  const langConfig = await getLanguagesConfig();
  const uiLang = getLocale(cookieStore, langConfig.default);

  let artist;
  try {
    artist = await getArtist(artistId);
  } catch {
    notFound();
  }

  const albums = await getAlbumsForArtist(artistId);

  // Get songs for each album with translations
  const albumsWithSongs = await Promise.all(
    albums.map(async (album) => {
      const songs = await Promise.all(
        album.songs.map(async (songId) => {
          try {
            const song = await getSong(songId);
            const translations = await getSongTranslations(songId);
            if (
              !shouldShowSongInLanguage(
                translations,
                uiLang,
                langConfig.default
              )
            ) {
              return null;
            }
            const localizedTitle = await getSongTitle(songId, uiLang);
            return { ...song, translations, title: localizedTitle };
          } catch {
            return null;
          }
        })
      );
      const songDetails = songs.filter(
        (s): s is NonNullable<typeof s> => s !== null
      );
      if (songDetails.length === 0) return null;
      return {
        ...album,
        title: album.titles?.[uiLang] || album.title,
        songDetails,
      };
    })
  );

  const visibleAlbums = albumsWithSongs.filter(
    (a): a is NonNullable<typeof a> => a !== null
  );

  const totalSongs = visibleAlbums.reduce(
    (sum, album) => sum + album.songDetails.length,
    0
  );

  const session = await getSession();
  const showDeleteActions = canAdmin(session?.role ?? null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Artist header */}
      <div className="mb-8">
        <Link
          href="/artists"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block"
        >
          &larr; All Artists
        </Link>
        <h1 className="text-3xl font-bold">{artist.name}</h1>
        {artist.bio && (
          <p className="mt-2 text-neutral-600 dark:text-neutral-400 max-w-2xl">
            {artist.bio}
          </p>
        )}
        <div className="flex items-center gap-3 mt-3 text-sm text-neutral-500">
          {artist.website && (
            <a
              href={artist.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Website
            </a>
          )}
          <span>
            {visibleAlbums.length} album{visibleAlbums.length !== 1 ? "s" : ""} &middot;{" "}
            {totalSongs} song{totalSongs !== 1 ? "s" : ""}
          </span>
        </div>
        {artist.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {artist.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-600 dark:text-neutral-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {showDeleteActions && (
          <div className="flex gap-2 mt-4">
            <DeleteButton
              apiEndpoint="/api/artists"
              id={artistId}
              label={artist.name}
              redirectTo="/browse"
            />
          </div>
        )}
      </div>

      {/* Albums with songs */}
      <div className="space-y-8">
        {visibleAlbums.length === 0 ? (
          <p className="text-sm text-neutral-500"><T k="browse.noSongs" /></p>
        ) : (
          visibleAlbums.map((album) => (
            <div
              key={album.id}
              className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden"
            >
              <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <Link
                    href={`/albums/${album.id}`}
                    className="font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {album.title}
                  </Link>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    {album.year && <span>{album.year} &middot; </span>}
                    {album.songDetails.length} song
                    {album.songDetails.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <Link
                  href={`/albums/${album.id}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View album &rarr;
                </Link>
              </div>
              <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {album.songDetails.map(
                  (song, index) =>
                    song && (
                      <li key={song.id}>
                        <Link
                          href={`/songs/${song.id}`}
                          className="flex items-center gap-4 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                        >
                          <span className="text-sm text-neutral-400 w-6 text-right font-mono">
                            {index + 1}
                          </span>
                          <span className="flex-1 min-w-0 font-medium text-sm">
                            {song.title}
                          </span>
                          {song.key && (
                            <span className="text-xs text-neutral-400">
                              {song.key}
                            </span>
                          )}
                          <div className="flex gap-0.5">
                            {song.translations.map((lang: string) => (
                              <span
                                key={lang}
                                className="text-[10px] px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-500"
                              >
                                {lang.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </Link>
                      </li>
                    )
                )}
              </ol>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
