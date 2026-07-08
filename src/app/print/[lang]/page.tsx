import { listSongs, getSongTranslation } from "@/lib/content";
import { renderToHtml } from "@/lib/chordpro";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";

export default async function PrintPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const songs = await listSongs();

  const songsWithContent: { id: string; title: string; html: string }[] = [];

  for (const song of songs) {
    try {
      const { body } = await getSongTranslation(song.id, lang);
      const html = renderToHtml(body);
      songsWithContent.push({ id: song.id, title: song.title, html });
    } catch {
      // Song doesn't have this language, skip
    }
  }

  const printStyles = `
    @media print {
      .no-print { display: none !important; }
      header { display: none !important; }
      .song-page { page-break-after: always; }
      .song-page:last-child { page-break-after: auto; }
      @page { margin: 2cm; size: A4; }
    }
  `;

  return (
    <div className="print-layout">
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      <div className="no-print max-w-4xl mx-auto px-4 py-4 mb-8 bg-neutral-100 dark:bg-neutral-900 rounded-lg flex items-center gap-4">
        <PrintButton />
        <span className="text-sm text-neutral-500">
          {songsWithContent.length} songs in {lang.toUpperCase()}
        </span>
        <Link href="/songs" className="text-sm text-blue-600 hover:underline ml-auto">
          Back to Songs
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Table of Contents */}
        <div className="toc mb-12 no-print">
          <h2 className="text-xl font-bold mb-4">Table of Contents</h2>
          <ol className="list-decimal pl-6 space-y-1">
            {songsWithContent.map((song, i) => (
              <li key={i}>
                <a href={`#song-${song.id}`} className="text-blue-600 hover:underline">
                  {song.title}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* Songs */}
        {songsWithContent.map((song) => (
          <div key={song.id} id={`song-${song.id}`} className="song-page mb-12">
            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
              {song.title}
            </h2>
            <div
              className="chord-sheet"
              dangerouslySetInnerHTML={{ __html: song.html }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
