import Link from 'next/link';
import type { SongListItem } from '@/lib/content';

interface Props {
  songs: SongListItem[];
  languages: string[];
  defaultLanguage: string;
}

function statusCell(song: SongListItem, lang: string) {
  const translations = song.translations ?? [];
  const present = translations.includes(lang);
  const published = song.published?.[lang] === true;
  const chords = song.chordsPublished?.[lang] === true;
  const editHref = `/edit/${encodeURIComponent(song.id)}/${encodeURIComponent(lang)}`;

  if (!present) {
    return (
      <>
        <td key={`${lang}-song`} className="px-3 py-2 text-center text-xs">
          <Link href={editHref} className="text-amber-600 hover:underline dark:text-amber-400">
            missing
          </Link>
        </td>
        <td key={`${lang}-chords`} className="px-3 py-2 text-center text-xs text-neutral-400">—</td>
      </>
    );
  }

  return (
    <>
      <td key={`${lang}-song`} className="px-3 py-2 text-center text-xs">
        <Link href={editHref} className={published ? 'text-green-600 dark:text-green-400' : 'text-neutral-500 hover:underline'}>
          {published ? 'ok' : 'no'}
        </Link>
      </td>
      <td key={`${lang}-chords`} className="px-3 py-2 text-center text-xs">
        <Link href={editHref} className={chords ? 'text-green-600 dark:text-green-400' : 'text-neutral-500 hover:underline'}>
          {chords ? 'yes' : 'no'}
        </Link>
      </td>
    </>
  );
}

export function PublicationStatus({ songs, languages, defaultLanguage }: Props) {
  const sortedSongs = [...songs].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-2">Publication status</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Per-language publication matrix for songs and chords. Click a cell to open the editor.
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3 font-medium sticky left-0 bg-neutral-50 dark:bg-neutral-900">Song</th>
              {languages.map((lang) => (
                <>
                  <th key={`${lang}-song-h`} className="px-3 py-3 font-medium text-center">
                    {lang}<br />song
                  </th>
                  <th key={`${lang}-acc-h`} className="px-3 py-3 font-medium text-center">
                    {lang}<br />accords
                  </th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedSongs.map((song) => (
              <tr key={song.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium sticky left-0 bg-white dark:bg-neutral-950">
                  <Link
                    href={`/edit/${encodeURIComponent(song.id)}/${encodeURIComponent(defaultLanguage)}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {song.id}
                  </Link>
                  <div className="text-xs text-neutral-500 truncate max-w-[18rem]">{song.title}</div>
                </td>
                {languages.map((lang) => statusCell(song, lang))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}