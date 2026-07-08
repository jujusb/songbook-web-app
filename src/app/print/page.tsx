import { listAlbums, getLanguagesConfig, listArtists } from "@/lib/content";
import { PrintConfigForm } from "@/components/PrintConfigForm";

export default async function PrintConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ album?: string }>;
}) {
  const { album: preselectedAlbum } = await searchParams;
  const [albums, langConfig, artists] = await Promise.all([
    listAlbums(),
    getLanguagesConfig(),
    listArtists(),
  ]);

  const artistMap = new Map(artists.map((a) => [a.id, a.name]));

  const albumOptions = albums.map((a) => ({
    id: a.id,
    title: a.title,
    artist: artistMap.get(a.artist) || a.artist,
    songCount: a.songs.length,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Print Songbook</h1>
      <PrintConfigForm
        albums={albumOptions}
        languages={langConfig.languages.map((l) => ({
          code: l.code,
          label: l.label,
        }))}
        defaultLang={langConfig.default}
        preselectedAlbum={preselectedAlbum}
      />
    </div>
  );
}
