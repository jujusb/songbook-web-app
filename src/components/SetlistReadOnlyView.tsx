import Link from "next/link";
import { shouldShowSongInLanguage } from "@/lib/content";
import { languageLabelFor } from "@/lib/i18n/labels";
import { SetlistVoiceLinks } from "@/components/SetlistVoiceLinks";

export interface SetlistReadOnlySong {
  songId: string;
  lang: string;
  title: string;
  key?: string;
  translations: string[];
}

/**
 * Read-only song order for a setlist, as shown to non-editors and to anyone
 * reaching the setlist through its share link. Filters songs by the selected
 * language like the full setlist page.
 */
export function SetlistReadOnlyView({
  songs,
  selectedLang,
  defaultLang,
}: {
  songs: SetlistReadOnlySong[];
  selectedLang: string;
  defaultLang: string;
}) {
  const visible = songs.filter((song) =>
    shouldShowSongInLanguage(song.translations, selectedLang, defaultLang)
  );

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
          Song Order
        </span>
      </div>
      <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {visible.map((song, index) => (
          <li key={`${song.songId}-${index}`}>
            <div className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
              <span className="text-sm text-neutral-400 w-8 text-right font-mono">
                {index + 1}
              </span>
              <Link
                href={`/songs/${song.songId}`}
                className="flex-1 font-medium hover:underline"
              >
                {song.title}
              </Link>
              {song.key && (
                <span className="text-xs text-neutral-400">{song.key}</span>
              )}
              <span className="text-xs px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-500">
                {languageLabelFor(song.lang)}
              </span>
              <SetlistVoiceLinks songId={song.songId} lang={song.lang} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}