import { notFound, redirect } from "next/navigation";
import { listAlbums, listArtists, getLanguagesConfig } from "@/lib/content";
import { getSession, canEdit } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
import { BulkImport } from "@/components/BulkImport";
import { T } from "@/components/Translate";

export default async function BulkImportPage() {
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect("/login");

  const [albums, artists, langConfig] = await Promise.all([
    listAlbums(),
    listArtists(),
    getLanguagesConfig(),
  ]);

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-2">
        <T k="bulkImport.heading" />
      </h1>
      <p className="text-sm text-neutral-500 mb-6 max-w-3xl">
        <T k="bulkImport.description" />
      </p>
      <BulkImport
        albums={albums.map((a) => ({
          id: a.id,
          title: a.title,
          artist: a.artist,
          year: a.year,
        }))}
        artists={artists.map((a) => ({ id: a.id, name: a.name }))}
        languages={langConfig.languages}
        defaultLang={langConfig.default}
      />
    </div>
  );
}
