import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import ChordSheetJS from "chordsheetjs";

const MUSIC_DIR = () =>
  process.env.MUSIC_DIR || path.join(process.cwd(), "public", "music");

function extractLyricsFromChordPro(body: string): string {
  try {
    const parser = new ChordSheetJS.ChordProParser();
    const song = parser.parse(body);
    const lines: string[] = [];

    for (const line of song.lines) {
      if (line.type === "verse") {
        const text = line.items
          .map((item: any) =>
            item instanceof ChordSheetJS.ChordLyricsPair ? item.lyrics ?? "" : "",
          )
          .join("");
        lines.push(text.trimEnd());
      } else if (line.type === "empty") {
        lines.push("");
      }
    }

    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return fallbackExtractLyrics(body);
  }
}

function fallbackExtractLyrics(body: string): string {
  return body
    .split("\n")
    .map((line) => {
      line = line.replace(/\[[^\]]+\]/g, "");
      if (/^\{[\w_]+\}/.test(line.trim())) return "";
      if (/^\{[\w_]+:\s*(.+)\}$/.test(line.trim())) {
        const match = line.trim().match(/^\{[\w_]+:\s*(.+)\}$/);
        if (
          match &&
          !/^(start_of|end_of)/.test(line.trim()) &&
          !/^(title|key|tempo|time)/.test(line.trim())
        ) {
          return match[1];
        }
        return "";
      }
      return line;
    })
    .filter((line) => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function audioPathToMusicDir(audioPath: string): string | null {
  const prefix = "/api/music/";
  if (audioPath.startsWith(prefix)) {
    return audioPath.slice(prefix.length);
  }
  if (audioPath.startsWith("/music/")) {
    return audioPath.slice("/music/".length);
  }
  return null;
}

export async function syncSongToMusicDir(
  songId: string,
  lang: string,
  body: string,
): Promise<void> {
  const root = MUSIC_DIR();
  if (!existsSync(root)) return;

  const targetDirs = new Set<string>();

  try {
    const { getSong } = await import("@/lib/content");
    const meta = await getSong(songId);
    for (const af of meta.audioFiles ?? []) {
      if (af.lang !== lang) continue;
      const relDir = audioPathToMusicDir(af.path);
      if (relDir) {
        const dir = path.dirname(path.join(root, relDir));
        targetDirs.add(dir);
      }
    }
  } catch {
    // Song not found or no audio files — use fallback path
  }

  if (targetDirs.size === 0) {
    // Fallback: <music-dir>/<songId>/<lang>/
    targetDirs.add(path.join(root, songId, lang));
  }

  const lyrics = extractLyricsFromChordPro(body);

  for (const dir of targetDirs) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${lang}.cho`), body, "utf-8");
    await writeFile(path.join(dir, `${lang}.txt`), lyrics, "utf-8");
  }
}
