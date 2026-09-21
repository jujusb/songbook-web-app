import { getSong } from "@/lib/content";
import Link from "next/link";

const VOICE_LABELS: Record<string, string> = {
  "feminine": "F",
  "masculine": "M",
  "guide": "G",
  "all": "A",
  "full": "♪",
};

const VOICE_COLORS: Record<string, string> = {
  "feminine": "bg-pink-100 dark:bg-pink-950 text-pink-500 dark:text-pink-400",
  "masculine": "bg-blue-100 dark:bg-blue-950 text-blue-500 dark:text-blue-400",
  "guide": "bg-amber-100 dark:bg-amber-950 text-amber-500 dark:text-amber-400",
  "all": "bg-green-100 dark:bg-green-950 text-green-500 dark:text-green-400",
  "full": "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400",
};

export async function SetlistVoiceLinks({
  songId,
  lang,
}: {
  songId: string;
  lang: string;
}) {
  let audioFiles: { voice: string; path: string }[] = [];
  try {
    const meta = await getSong(songId);
    audioFiles = (meta.audioFiles ?? []).filter((af) => af.lang === lang);
  } catch {
    // song or audio files not found
  }

  if (audioFiles.length === 0) return null;

  // Deduplicate voices
  const seen = new Set<string>();
  const voices = audioFiles.filter((af) => {
    const key = af.voice;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="flex items-center gap-1 ml-2">
      <Link
        href={`/music/${songId}?lang=${lang}`}
        className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-80 transition-opacity font-medium"
      >
        ♪
      </Link>
      {voices.map((af) => (
        <Link
          key={af.voice}
          href={`/music/${songId}?lang=${lang}`}
          title={af.voice}
          className={`text-[10px] px-1 py-0.5 rounded font-medium transition-opacity hover:opacity-80 ${VOICE_COLORS[af.voice] || "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"}`}
        >
          {VOICE_LABELS[af.voice] ?? af.voice}
        </Link>
      ))}
    </div>
  );
}
