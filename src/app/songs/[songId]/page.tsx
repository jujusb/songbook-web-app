import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  getSong,
  getSongTranslation,
  getSongTranslations,
  getSongTitle,
  getAlbumsForSong,
  getArtistForSong,
  getSiteConfig,
  getLanguagesConfig,
  listAlbums,
} from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canEdit, canAdmin } from "@/lib/auth";
import { ChordSheet } from "@/components/ChordSheet";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ReferencePanel } from "@/components/ReferencePanel";
import { MusicReader } from "@/components/MusicReader";
import { DeleteButton } from "@/components/DeleteButton";
import { ChangeIdButton } from "@/components/ChangeIdButton";
import { ChangeAlbumButton } from "@/components/ChangeAlbumButton";
import { NavidromeShareButton } from "@/components/NavidromeShareButton";
import { T } from "@/components/Translate";
import { getNavidromeConfig } from "@/lib/navidrome/config";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { VoiceSections } from "@/components/VoiceSections";
import { PartitionViewer } from "@/components/PartitionViewer";

export default async function SongPage({
  params,
  searchParams,
}: {
  params: Promise<{ songId: string }>;
  searchParams: Promise<{ lang?: string; parts?: string }>;
}) {
  const { songId } = await params;
  const { lang: langParam, parts } = await searchParams;

  let meta;
  try {
    meta = await getSong(songId);
  } catch {
    notFound();
  }

  const translations = await getSongTranslations(songId);
  if (translations.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">{meta.title}</h1>
        <p className="text-neutral-500">No translations available.</p>
      </div>
    );
  }

  const langConfig = await getLanguagesConfig();
  const selectedLang = getLocale(await cookies(), langConfig.default);
  const lang =
    langParam && translations.includes(langParam)
      ? langParam
      : translations.includes(selectedLang)
        ? selectedLang
        : translations[0];

  const { body } = await getSongTranslation(songId, lang);
  const localizedTitle = await getSongTitle(songId, lang);
  const albums = await getAlbumsForSong(songId);
  const artist = await getArtistForSong(songId);
  const allAlbums = await listAlbums();

  let enableArtistPages = false;
  try {
    const config = await getSiteConfig();
    enableArtistPages = config.enableArtistPages;
  } catch {}

  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);
  const showDeleteActions = canAdmin(session?.role ?? null);

  const isOriginalVersion = lang === langConfig.default;
  const spotify = meta.spotify;
  const showSpotify = isOriginalVersion;
  const showNavidrome = getNavidromeConfig() !== null && !isOriginalVersion;

  const partitions = meta.partitions ?? [];
  const showParts = parts === "1";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{localizedTitle}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {artist && enableArtistPages && (
              <Link
                href={`/artists/${artist.id}`}
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {artist.name}
              </Link>
            )}
            {artist && !enableArtistPages && (
              <span className="text-sm text-neutral-500">{artist.name}</span>
            )}
            {meta.key && (
              <span className="text-sm text-neutral-500">Key: {meta.key}</span>
            )}
            {albums.length > 0 && (
              <div className="flex items-center gap-1.5">
                {albums.map((album) => (
                  <Link
                    key={album.id}
                    href={`/albums/${album.id}`}
                    className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                  >
                    {album.titles?.[lang] || album.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          {showEditActions && (
            <>
              <Link
                href={`/edit/${songId}/${lang}`}
                className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <T k="song.edit" />
              </Link>
              <Link
                href={`/edit/${songId}/${lang}?references=1`}
                className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <T k="song.editReferences" />
              </Link>
            </>
          )}
          <Link
            href={`/present/${songId}?lang=${lang}`}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <T k="song.present" />
          </Link>
          <Link
            href={`/compare/${songId}?langs=${translations.join(",")}`}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <T k="song.compare" />
          </Link>
          {meta.audioFiles && meta.audioFiles.length > 0 && (
            <Link
              href={`/music/${songId}?lang=${lang}`}
              className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <T k="song.listen" />
            </Link>
          )}
          {showNavidrome && (
            <NavidromeShareButton
              key={`${songId}:${lang}`}
              type="song"
              id={songId}
              lang={lang}
            />
          )}
          {showSpotify && (
            <SpotifyPlayer
              type="track"
              id={songId}
              lang={lang}
              explicitUrl={spotify?.song ?? null}
              title={localizedTitle}
              artist={artist?.name}
            />
          )}
          {showSpotify && meta.youtube && (
            <YouTubePlayer url={meta.youtube} title={localizedTitle} />
          )}
          {showDeleteActions && (
            <>
              <ChangeAlbumButton
                songId={songId}
                currentAlbumIds={albums.map((a) => a.id)}
                albums={allAlbums.map((a) => ({ id: a.id, title: a.title, artist: a.artist }))}
              />
              <ChangeIdButton songId={songId} lang={lang} />
              <DeleteButton
                apiEndpoint="/api/songs"
                id={songId}
                label={meta.title}
                redirectTo="/browse"
              />
            </>
          )}
        </div>
      </div>

      <VoiceSections id={songId} lang={lang} />

      <LanguageSwitcher
        songId={songId}
        languages={translations}
        currentLang={lang}
        extraTab={
          partitions.length > 0
            ? {
                href: `/songs/${songId}?lang=${lang}&parts=1`,
                active: showParts,
              }
            : undefined
        }
      />

      {showParts ? (
        partitions.length > 0 ? (
          <PartitionViewer partitions={partitions} />
        ) : (
          <p className="mt-6 text-neutral-500">
            <T k="partitions.none" />
          </p>
        )
      ) : (
        <>
          {meta.audioFiles && meta.audioFiles.length > 0 && (
            <div className="mt-6">
              <MusicReader audioFiles={meta.audioFiles} songTitle={localizedTitle} />
            </div>
          )}

          <div className="mt-6 flex gap-8">
            <div className="flex-1 min-w-0">
              <ChordSheet
                initialSource={body}
                songKey={meta.key ?? null}
                references={meta.references}
                lang={lang}
              />
            </div>

            {meta.references.length > 0 && (
              <aside className="w-64 shrink-0 hidden lg:block">
                <ReferencePanel references={meta.references} lang={lang} />
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
