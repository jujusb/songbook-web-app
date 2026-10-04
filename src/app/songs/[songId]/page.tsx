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
import { isReadOnly } from "@/lib/readonly";
import { ChordSheet } from "@/components/ChordSheet";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ReferencePanel } from "@/components/ReferencePanel";
import { MusicReader } from "@/components/MusicReader";
import { DeleteButton } from "@/components/DeleteButton";
import { ChangeIdButton } from "@/components/ChangeIdButton";
import { ChangeAlbumButton } from "@/components/ChangeAlbumButton";
import { NavidromeShareButton } from "@/components/NavidromeShareButton";
import { ActionMenu } from "@/components/ActionMenu";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { T } from "@/components/Translate";
import { getNavidromeConfig } from "@/lib/navidrome/config";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { VoiceSections } from "@/components/VoiceSections";
import { PartitionViewer } from "@/components/PartitionViewer";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ songId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { songId } = await params;
  const { lang } = await searchParams;
  try {
    const meta = await getSong(songId);
    const langConfig = await getLanguagesConfig();
    const translations = await getSongTranslations(songId);
    const selectedLang = lang && translations.includes(lang)
      ? lang
      : translations[0] ?? langConfig.default;
    const localizedTitle = await getSongTitle(songId, selectedLang);
    const albums = await getAlbumsForSong(songId);
    const albumPart = albums[0] ? `${albums[0].title} · ` : "";
    return {
      title: `${localizedTitle} · ${albumPart}Songbook`,
    };
  } catch {
    return {
      title: "Songbook",
    };
  }
}

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
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">{meta.title}</h1>
        <p className="text-neutral-500">No translations available.</p>
      </div>
    );
  }

  const session = await getSession();
  const isAdmin = canAdmin(session?.role ?? null);

  const langConfig = await getLanguagesConfig();
  const selectedLang = getLocale(await cookies(), langConfig.default);
  const lang =
    langParam && translations.includes(langParam)
      ? langParam
      : translations.includes(selectedLang)
        ? selectedLang
        : translations[0];

  // Check if translation is published for non-admin users
  const { meta: translationMeta, body, capo, key: bodyKey } = await getSongTranslation(songId, lang);
  if (!isAdmin && !translationMeta.published) {
    notFound();
  }
  const localizedTitle = await getSongTitle(songId, lang);
  const albums = await getAlbumsForSong(songId);
  const artist = await getArtistForSong(songId);
  const allAlbums = await listAlbums();

  let enableArtistPages = false;
  try {
    const config = await getSiteConfig();
    enableArtistPages = config.enableArtistPages;
  } catch {}

  const showEditActions = !isReadOnly() && canEdit(session?.role ?? null);
  const showDeleteActions = canAdmin(session?.role ?? null);

  const isOriginalVersion = lang === langConfig.default;
  const spotify = meta.spotify;
  const showSpotify = isOriginalVersion;
  const showNavidrome = getNavidromeConfig() !== null && !isOriginalVersion;

  const partitions = meta.partitions ?? [];
  const showParts = parts === "1";

  // Build action menu items - only for simple navigation actions
  const primaryActions = [
    {
      label: "Edit",
      href: `/edit/${songId}/${lang}`,
    },
    {
      label: "Edit References",
      href: `/edit/${songId}/${lang}?references=1`,
    },
    {
      label: "Present",
      href: `/present/${songId}?lang=${lang}`,
    },
    {
      label: "Compare",
      href: `/compare/${songId}?langs=${translations.join(",")}`,
    },
  ];

  const secondaryActions = [];
  if (meta.audioFiles && meta.audioFiles.length > 0) {
    secondaryActions.push({
      label: "Listen",
      href: `/music/${songId}?lang=${lang}`,
    });
  }
  if (showNavidrome) {
    secondaryActions.push({
      label: "Share via Navidrome",
      onClick: () => {}, // NavidromeShareButton handles its own click
    });
  }

  const adminActions = showDeleteActions ? [] : [];

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Compact header with title and action menu */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{localizedTitle}</h1>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <div className="flex flex-wrap items-center gap-2 justify-end sm:justify-end">
              {/* Primary actions - Edit, Present, Compare */}
              <Link
                href={`/edit/${songId}/${lang}`}
                className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors hidden sm:inline-flex"
              >
                Edit
              </Link>
              <Link
                href={`/edit/${songId}/${lang}?references=1`}
                className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors hidden sm:inline-flex"
              >
                Edit References
              </Link>
              <Link
                href={`/present/${songId}?lang=${lang}`}
                className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors hidden sm:inline-flex"
              >
                Present
              </Link>
              <Link
                href={`/compare/${songId}?langs=${translations.join(",")}`}
                className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors hidden sm:inline-flex"
              >
                Compare
              </Link>

              {/* Mobile: ActionMenu for primary actions */}
              <div className="sm:hidden">
                <ActionMenu
                  items={primaryActions}
                  triggerIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  }
                />
              </div>

              {/* Secondary actions - Listen, Navidrome Share */}
              {meta.audioFiles && meta.audioFiles.length > 0 && (
                <Link
                  href={`/music/${songId}?lang=${lang}`}
                  className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Listen
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

              {/* Admin actions - Change Album, Change ID, Delete */}
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
        </div>

        {/* Collapsible Song Info - default closed on mobile, open on desktop */}
        <CollapsibleSection
          title="Song Info"
          defaultOpen={false}
          className="md:hidden mb-4"
        >
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {artist && enableArtistPages && (
              <Link
                href={`/artists/${artist.id}`}
                className="text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {artist.name}
              </Link>
            )}
            {artist && !enableArtistPages && (
              <span className="text-neutral-500">{artist.name}</span>
            )}
            {meta.key && (
              <span className="text-neutral-500">Key: {meta.key}</span>
            )}
            {albums.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
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
        </CollapsibleSection>

        {/* Desktop Song Info - always visible */}
        <div className="hidden md:flex flex-wrap items-center gap-3 text-sm mb-4">
          {artist && enableArtistPages && (
            <Link
              href={`/artists/${artist.id}`}
              className="text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {artist.name}
            </Link>
          )}
          {artist && !enableArtistPages && (
            <span className="text-neutral-500">{artist.name}</span>
          )}
          {meta.key && (
            <span className="text-neutral-500">Key: {meta.key}</span>
          )}
          {albums.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
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

      <VoiceSections id={songId} lang={lang} />

      {/* Language Switcher - auto switches to select on mobile */}
      <LanguageSwitcher
        songId={songId}
        languages={translations}
        currentLang={lang}
        variant="auto"
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

          <div className="mt-6">
            <ChordSheet
              initialSource={body}
              songKey={bodyKey ?? meta.key ?? null}
              songCapo={capo ?? null}
              references={meta.references}
              lang={lang}
            />

            {/* References - collapsible on mobile, sidebar on desktop */}
            {meta.references.length > 0 && (
              <>
                <div className="lg:hidden mt-6">
                  <ReferencePanel
                    references={meta.references}
                    lang={lang}
                    variant="collapsible"
                    defaultOpen={false}
                  />
                </div>
                <aside className="hidden lg:block w-64 shrink-0 mt-6 lg:mt-0 lg:ml-8">
                  <ReferencePanel
                    references={meta.references}
                    lang={lang}
                    variant="sidebar"
                  />
                </aside>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
