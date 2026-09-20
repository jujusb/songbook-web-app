import Link from "next/link";
import { cookies } from "next/headers";
import { listAlbums, listArtists } from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canEdit } from "@/lib/auth";
import { T } from "@/components/Translate";

export default async function AlbumsPage() {
  const [albums, artists] = await Promise.all([listAlbums(), listArtists()]);
  const uiLang = getLocale(await cookies());
  const artistMap = new Map(artists.map((a) => [a.id, a.name]));
  const session = await getSession();
  const showEditActions = canEdit(session?.role ?? null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold"><T k="album.title" /></h1>
        {showEditActions && (
          <Link
            href="/albums/new"
            className="text-sm px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            <T k="album.newAlbum" />
          </Link>
        )}
      </div>

      {albums.length === 0 ? (
        <p className="text-neutral-500"><T k="album.noAlbums" /></p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/albums/${album.id}`}
              className="block p-5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              <h2 className="font-semibold text-lg mb-1">
                {album.titles?.[uiLang] || album.title}
              </h2>
              <p className="text-sm text-neutral-500 mb-1">
                {artistMap.get(album.artist) || album.artist}
              </p>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                {album.year && <span>{album.year}</span>}
                <span>
                  {album.songs.length} song
                  {album.songs.length !== 1 ? "s" : ""}
                </span>
              </div>
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
