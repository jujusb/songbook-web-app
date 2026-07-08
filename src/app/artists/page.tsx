import Link from "next/link";
import { redirect } from "next/navigation";
import { listArtists, getSiteConfig } from "@/lib/content";
import { T } from "@/components/Translate";

export default async function ArtistsPage() {
  const config = await getSiteConfig();
  if (!config.enableArtistPages) {
    redirect("/songs");
  }

  const artists = await listArtists();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6"><T k="artist.title" /></h1>

      {artists.length === 0 ? (
        <p className="text-neutral-500"><T k="artist.noArtists" /></p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist) => (
            <Link
              key={artist.id}
              href={`/artists/${artist.id}`}
              className="block p-5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              <h2 className="font-semibold text-lg mb-1">{artist.name}</h2>
              {artist.bio && (
                <p className="text-sm text-neutral-500 line-clamp-2 mb-2">
                  {artist.bio}
                </p>
              )}
              {artist.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
