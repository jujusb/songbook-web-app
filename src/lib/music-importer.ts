import { readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { parseFile } from "music-metadata";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface MusicVoiceFile {
  voice: string;
  path: string;
  label: string;
}

export interface MusicLanguageGroup {
  lang: string;
  isOriginal: boolean;
  album?: string;
  title?: string;
  voices: MusicVoiceGroup[];
  lyricPath?: string;
  guidePaths?: string[];
}

export interface MusicVoiceGroup {
  voice: string;
  files: MusicVoiceFile[];
}

export interface MusicScanItem {
  songId: string;
  title: string;
  existing: boolean;
  languages: MusicLanguageGroup[];
}

export type MusicScanResult = MusicScanItem[];

/* ------------------------------------------------------------------ */
/*  Scan configuration                                                */
/* ------------------------------------------------------------------ */

export interface VoiceDirMapping {
  dirName: string;
  voice: string;
}

export interface LangFolderConfig {
  dirName: string;
  lang: string;
  isOriginal: boolean;
  voiceDirs: VoiceDirMapping[];
  guideDirs?: VoiceDirMapping[];
  /** Subdirectory names within the scan root that contain albums. When set, the flat
   *  scanner only processes these subdirs (skipping voice/guide/skip dirs). */
  albumDirs?: string[];
  /** When true, children of this folder are language-named subdirs (e.g. ES/, EN/),
   *  each of which is then scanned using this entry's voiceDirs config. */
  nestedLanguages?: boolean;
}

export interface ScanConfig {
  folders: LangFolderConfig[];
}



/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const MUSIC_DIR = () => process.env.MUSIC_DIR || path.join(process.cwd(), "public", "music");

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function stripNumberPrefix(name: string): string {
  return name.replace(/^[\d]+\s*[\.\-\)]\s*/, "").trim();
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractTitle(name: string): string {
  const withoutExt = name.replace(/\.\w+$/, "");
  return stripAccents(stripNumberPrefix(withoutExt)).trim();
}

function extractNumber(name: string): string | null {
  const match = name.match(/^(\d+)/);
  return match ? match[1] : null;
}

/* ------------------------------------------------------------------ */
/*  Audio metadata reader                                             */
/* ------------------------------------------------------------------ */

interface AudioMeta {
  title?: string;
  artist?: string;
  album?: string;
  track?: number;
  year?: number;
  key?: string;
}

const metadataCache = new Map<string, AudioMeta>();

export function clearMetadataCache(): void {
  metadataCache.clear();
}

async function readAudioMetadata(filePath: string): Promise<AudioMeta> {
  if (metadataCache.has(filePath)) return metadataCache.get(filePath)!;
  try {
    const md = await parseFile(filePath);
    const result: AudioMeta = {};
    if (md.common.title) result.title = md.common.title;
    if (md.common.artist) result.artist = md.common.artist;
    if (md.common.album) result.album = md.common.album;
    if (md.common.track?.no) result.track = md.common.track.no;
    if (md.common.year) result.year = md.common.year;
    if (md.common.comment?.length) {
      for (const c of md.common.comment) {
        const text = c.text;
        if (text && /^[A-G][#b]?\s*(m|min|maj|major|minor)?$/i.test(text.trim())) {
          result.key = text.trim();
          break;
        }
      }
    }
    if (!result.key && md.native) {
      for (const format of Object.values(md.native)) {
        for (const tag of format as { id: string; value: string }[]) {
          if (tag.id?.toLowerCase() === "tkey" || tag.id?.toLowerCase() === "key") {
            result.key = tag.value;
          }
        }
      }
    }
    metadataCache.set(filePath, result);
    return result;
  } catch {
    metadataCache.set(filePath, {});
    return {};
  }
}

/* ------------------------------------------------------------------ */
/*  Lyric file helper                                                  */
/* ------------------------------------------------------------------ */

async function findLyricFile(dirPath: string, root: string): Promise<string | undefined> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".txt")) {
      return path.relative(root, path.join(dirPath, entry.name));
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Scanner                                                            */
/* ------------------------------------------------------------------ */

export async function scanMusicDir(
  songId?: string,
  providedConfig?: ScanConfig,
): Promise<MusicScanResult> {
  clearMetadataCache();
  const root = MUSIC_DIR();
  if (!existsSync(root)) return [];
  if (!providedConfig) return [];

  const results: Map<string, MusicScanItem> = new Map();

  // Known voice prefixes that get skipped when extracting the actual song name
  const VOICE_PREFIXES = [
    /^chicas\s+baja\s*[-–—]\s*/i,
    /^chicas\s+alta\s*[-–—]\s*/i,
    /^chicos\s+baja\s*[-–—]\s*/i,
    /^chicos\s+alta\s*[-–—]\s*/i,
    /^chicas\s*[-–—]\s*/i,
    /^chicos\s*[-–—]\s*/i,
    /^\(2ª\s+mitad\)\s*/i,
  ];

  function stripVoicePrefix(s: string): string {
    let result = s;
    for (const re of VOICE_PREFIXES) {
      result = result.replace(re, "").trim();
    }
    return result;
  }

  // Strip diacritics (accents) from a string
  function stripAccents(s: string): string {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // Strip leading Roman numeral prefixes (I, II, III, IV, V, VI, VII, VIII, IX, X, XI, XII, XIII, XIV, XV, XVI)
  function stripRomanPrefix(s: string): string {
    return s.replace(
      /^(?:X{0,3}(?:IX|IV|V?I{0,3}))(?:\s*[\.\-\)]\s*|\s+)/i,
      "",
    ).trim();
  }

  // Normalise a title for matching: strip accents, lowercase, strip number/Roman prefix, strip parenthetical suffixes
  function normaliseForMatch(s: string): string {
    return stripAccents(
      stripRomanPrefix(
        stripNumberPrefix(s)
          .replace(/\s*\([^)]*\)\s*/g, "")
          .replace(/[¿?_,!¡]+/g, " ")
          .trim(),
      ),
    ).toLowerCase().trim();
  }

  // Check if two normalized strings match — exact, or word-boundary substring for longer phrases
  function titlesMatch(a: string, b: string): boolean {
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (short.length < 5) return false;
    // Word-boundary check: short must appear as a whole word/phrase in long
    const idx = long.indexOf(short);
    if (idx === -1) return false;
    const before = idx === 0 || long[idx - 1] === " ";
    const after = idx + short.length >= long.length || long[idx + short.length] === " ";
    return before && after;
  }

  // Find existing result by album + title (for merging voice results into album scans).
  // Falls back to title-only matching when album doesn't line up.
  function findResultByAlbumAndTitle(album: string, title: string, outCanonical: { value: string }): MusicScanItem | undefined {
    const albumClean = stripAccents(stripNumberPrefix(album).toLowerCase());
    const titleNorm = normaliseForMatch(title);
    const titleNormClean = normaliseForMatch(stripVoicePrefix(title));

    for (const item of results.values()) {
      const itemNorm = normaliseForMatch(item.title);
      const matched = titlesMatch(itemNorm, titleNorm) || titlesMatch(itemNorm, titleNormClean);
      if (!matched) continue;

      // Album must match too, unless the voice result has no matching album in results
      const hasMatchingLang = item.languages.some(
        (l) => l.album && stripAccents(stripNumberPrefix(l.album).toLowerCase()) === albumClean,
      );
      if (!hasMatchingLang) {
        // Fallback: if the item already has a "full" voice, match by title alone
        const hasFull = item.languages.some((l) => l.voices.some((v) => v.voice === "full"));
        if (!hasFull) continue;
      }

      // Use the shorter / cleaner title as canonical
      const candidates = [item.title, title, stripVoicePrefix(title)].filter(Boolean);
      const clean = candidates.reduce((a, b) => a.length <= b.length ? a : b);
      if (clean.length < item.title.length) item.title = clean;
      outCanonical.value = clean;
      return item;
    }
    return undefined;
  }

  for (const folderCfg of providedConfig.folders) {
    const folderPath = path.join(root, folderCfg.dirName);
    if (!existsSync(folderPath)) continue;

    const isOriginal = folderCfg.isOriginal;
    const voiceMap = new Map<string, string>();
    for (const vd of folderCfg.voiceDirs ?? []) {
      voiceMap.set(vd.dirName.toLowerCase(), vd.voice);
    }
    let hasVoiceDirs = (folderCfg.voiceDirs?.length ?? 0) > 0;

    // Determine scan roots — either the folder path itself, or nested language subdirs
    interface ScanRoot { scanPath: string; lang: string }
    let scanRoots: ScanRoot[];

    if (folderCfg.nestedLanguages) {
      let langDirEntries: { name: string; isDirectory(): boolean }[];
      try { langDirEntries = await readdir(folderPath, { withFileTypes: true }); } catch { continue; }
      scanRoots = [];

      // Auto-discover voice dirs from the first language subdir when none configured
      if (!hasVoiceDirs) {
        for (const langDir of langDirEntries) {
          if (!langDir.isDirectory()) continue;
          const langDirPath = path.join(folderPath, langDir.name);
          let voiceCandidates: { name: string; isDirectory(): boolean }[];
          try { voiceCandidates = await readdir(langDirPath, { withFileTypes: true }); } catch { continue; }
          const subdirs = voiceCandidates.filter((e) => e.isDirectory()).map((e) => e.name);
          if (subdirs.length > 0) {
            for (const sd of subdirs) {
              const key = sd.toLowerCase().trim();
              if (!voiceMap.has(key)) {
                voiceMap.set(key, sd);
              }
            }
            break;
          }
        }
        hasVoiceDirs = voiceMap.size > 0;
      }

      for (const langDir of langDirEntries) {
        if (!langDir.isDirectory()) continue;
        scanRoots.push({
          scanPath: path.join(folderPath, langDir.name),
          lang: langDir.name.toLowerCase(),
        });
      }
    } else {
      scanRoots = [{ scanPath: folderPath, lang: folderCfg.lang }];
    }

    // Build guide dir lookup
    const guideSet = new Set<string>();
    for (const gd of folderCfg.guideDirs ?? []) {
      guideSet.add(gd.dirName.toLowerCase());
    }

    for (const { scanPath, lang } of scanRoots) {
      if (hasVoiceDirs) {
        // ---  Voice-dir structure (e.g. Voices/<LANG>/<VOICE>/...)  ---
        let voiceDirEntries: { name: string; isDirectory(): boolean }[];
        try { voiceDirEntries = await readdir(scanPath, { withFileTypes: true }); } catch { continue; }
        for (const vDir of voiceDirEntries) {
          if (!vDir.isDirectory()) continue;
          const vDirLower = vDir.name.toLowerCase().trim();
          if (vDirLower === "descargarzip" || vDirLower === "antiguas versiones") continue;

          const isGuide = guideSet.has(vDirLower);
          const voiceName = voiceMap.get(vDirLower) ?? vDir.name;

          const albumsPath = path.join(scanPath, vDir.name);
          let albumDirs: { name: string; isDirectory(): boolean }[];
          try { albumDirs = await readdir(albumsPath, { withFileTypes: true }); } catch { continue; }

          for (const albumDir of albumDirs) {
            if (!albumDir.isDirectory()) continue;
            const albumName = albumDir.name;
            const albumDirPath = path.join(albumsPath, albumName);
            let subItems: { name: string; isDirectory(): boolean }[];
            try { subItems = await readdir(albumDirPath, { withFileTypes: true }); } catch { continue; }
            const hasSubdirs = subItems.some((si) => si.isDirectory());

            if (!hasSubdirs) {
              // Flat audio files — treat each as its own song
              const albumNumber = extractNumber(albumName);
              for (const item of subItems) {
                const ext = path.extname(item.name).toLowerCase();
                if (![".mp3", ".wav", ".ogg", ".mp4", ".m4a"].includes(ext)) continue;

                const meta = await readAudioMetadata(path.join(albumDirPath, item.name));
                const trackTitle = meta.title || extractTitle(item.name);
                const trackNumber = meta.track !== undefined ? String(meta.track) : extractNumber(item.name);
                const slug = albumNumber && trackNumber ? `${albumNumber}-${trackNumber}` : slugify(trackTitle);
                if (songId && slug !== songId) continue;

                const existing = await checkExisting(slug);
                const canonical = { value: trackTitle };
                const matched = results.get(slug) ?? findResultByAlbumAndTitle(albumName, trackTitle, canonical);
                const song: MusicScanItem = matched ?? {
                  songId: slug, title: canonical.value, existing, languages: [],
                };
                if (!matched) results.set(slug, song);

                let lg = song.languages.find((l) => l.lang === lang);
                if (!lg) { lg = { lang, isOriginal, album: albumName, title: trackTitle, voices: [] }; song.languages.push(lg); }

                // Associate matching lyric/txt file
                const stem = path.basename(item.name, path.extname(item.name));
                for (const candidate of subItems) {
                  const ce = path.extname(candidate.name).toLowerCase();
                  if (ce === ".txt" && path.basename(candidate.name, ce) === stem && !lg.lyricPath) {
                    lg.lyricPath = path.relative(root, path.join(albumDirPath, candidate.name));
                  }
                }

                let vg = lg.voices.find((v) => v.voice === voiceName);
                if (!vg) { vg = { voice: voiceName, files: [] }; lg.voices.push(vg); }
                vg.files.push({ voice: voiceName, path: path.relative(root, path.join(albumDirPath, item.name)), label: item.name });
              }
            } else {
              // Album has song subdirs
              for (const subItem of subItems) {
                if (!subItem.isDirectory()) continue;
                const songName = subItem.name;
                const songPath = path.join(albumDirPath, songName);
                let songFiles: string[];
                try { songFiles = await readdir(songPath); } catch { continue; }

                let songTitle = stripNumberPrefix(songName);
                for (const f of songFiles) {
                  const ext = path.extname(f).toLowerCase();
                  if (![".mp3", ".wav", ".ogg", ".mp4", ".m4a"].includes(ext)) continue;
                  const m = await readAudioMetadata(path.join(songPath, f));
                  if (m.title) { songTitle = m.title; break; }
                }

                const albumNumber = extractNumber(albumName);
                const songNumber = extractNumber(songName);
                const slug = albumNumber && songNumber ? `${albumNumber}-${songNumber}` : slugify(songTitle);
                if (songId && slug !== songId) continue;

                const files: MusicVoiceFile[] = [];
                const guides: string[] = [];
                let lyricPath: string | undefined;
                for (const f of songFiles) {
                  const ext = path.extname(f).toLowerCase();
                  if (isGuide && ext === ".pdf") {
                    guides.push(path.relative(root, path.join(songPath, f)));
                  } else if ([".mp3", ".wav", ".ogg", ".mp4", ".m4a"].includes(ext)) {
                    files.push({ voice: voiceName, path: path.relative(root, path.join(songPath, f)), label: f });
                  } else if (ext === ".txt" && !lyricPath) {
                    lyricPath = path.relative(root, path.join(songPath, f));
                  }
                }
                if (!files.length) continue;

                const existing = await checkExisting(slug);
                const canonical = { value: songTitle };
                const matched = results.get(slug) ?? findResultByAlbumAndTitle(albumName, songTitle, canonical);
                const item: MusicScanItem = matched ?? {
                  songId: slug, title: canonical.value, existing, languages: [],
                };
                if (!matched) results.set(slug, item);

                let lg = item.languages.find((l) => l.lang === lang);
                if (!lg) { lg = { lang, isOriginal, album: albumName, title: songTitle, voices: [] }; item.languages.push(lg); }
                if (lyricPath && !lg.lyricPath) lg.lyricPath = lyricPath;
                if (guides.length > 0) lg.guidePaths = [...(lg.guidePaths ?? []), ...guides];
                let vg = lg.voices.find((v) => v.voice === voiceName);
                if (!vg) { vg = { voice: voiceName, files: [] }; lg.voices.push(vg); }
                vg.files.push(...files);
              }
            }
          }
        }
      } else {
        // ---  Flat structure (no voice subdirs)  ---
        let entries: { name: string; isDirectory(): boolean }[];
        try { entries = await readdir(scanPath, { withFileTypes: true }); } catch { continue; }
        const albumDirSet = folderCfg.albumDirs?.length
          ? new Set(folderCfg.albumDirs.map((d) => d.toLowerCase()))
          : null;
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (albumDirSet && !albumDirSet.has(entry.name.toLowerCase())) continue;
          const albumName = entry.name;
          const albumPath = path.join(scanPath, albumName);
          let trackFiles: string[];
          try { trackFiles = await readdir(albumPath); } catch { continue; }

          // Look for a lyric file in the album directory
          let albumLyricPath: string | undefined;
          for (const f of trackFiles) {
            if (path.extname(f).toLowerCase() === ".txt") {
              albumLyricPath = path.relative(root, path.join(albumPath, f));
              break;
            }
          }

          for (const f of trackFiles) {
            const ext = path.extname(f).toLowerCase();
            if (![".mp3", ".wav", ".ogg", ".mp4", ".m4a"].includes(ext)) continue;

            const fullPath = path.join(albumPath, f);
            const meta = await readAudioMetadata(fullPath);
            const trackTitle = meta.title || extractTitle(f);
            const trackNumber = meta.track !== undefined ? String(meta.track) : extractNumber(f);
            const albumNumber = extractNumber(albumName);
            const slug = albumNumber && trackNumber ? `${albumNumber}-${trackNumber}` : slugify(trackTitle);
            if (songId && slug !== songId) continue;

            const existing = await checkExisting(slug);
            const item: MusicScanItem = results.get(slug) ?? {
              songId: slug, title: trackTitle, existing, languages: [],
            };
            if (!results.has(slug)) results.set(slug, item);

            let lg = item.languages.find((l) => l.lang === lang);
            if (!lg) { lg = { lang, isOriginal, album: meta.album || albumName, title: trackTitle, voices: [] }; item.languages.push(lg); }
            if (albumLyricPath && !lg.lyricPath) lg.lyricPath = albumLyricPath;
            let vg = lg.voices.find((v) => v.voice === "full");
            if (!vg) { vg = { voice: "full", files: [] }; lg.voices.push(vg); }
            vg.files.push({ voice: "full", path: path.relative(root, fullPath), label: f });
          }
        }
      }
    }
  }

  // Post-merge: fold voice-only results into matching full-song results.
  // This catches cases where voice dirs were processed before album dirs.
  const allResults = Array.from(results.values());
  for (const item of allResults) {
    const hasFull = item.languages.some((l) => l.voices.some((v) => v.voice === "full"));
    if (hasFull) continue;

    const itemNorm = normaliseForMatch(item.title);
    const itemAlbum = item.languages
      .map((l) => l.album && stripAccents(stripNumberPrefix(l.album).toLowerCase()))
      .find(Boolean);

    for (const candidate of allResults) {
      if (candidate === item) continue;
      const candidateHasFull = candidate.languages.some((l) => l.voices.some((v) => v.voice === "full"));
      if (!candidateHasFull) continue;

      const candidateNorm = normaliseForMatch(candidate.title);
      if (!titlesMatch(candidateNorm, itemNorm)) continue;

      // Album check: match if same album or one result has no album info
      const candidateAlbum = candidate.languages
        .map((l) => l.album && stripAccents(stripNumberPrefix(l.album).toLowerCase()))
        .find(Boolean);
      if (itemAlbum && candidateAlbum && itemAlbum !== candidateAlbum) continue;

      // Merge: move all languages from item into candidate
      for (const lg of item.languages) {
        let existing = candidate.languages.find((l) => l.lang === lg.lang);
        if (!existing) {
          // Create a new language group on the candidate
          existing = { lang: lg.lang, isOriginal: lg.isOriginal, album: lg.album, title: lg.title, voices: [], lyricPath: lg.lyricPath, guidePaths: lg.guidePaths };
          candidate.languages.push(existing);
        } else {
          // Merge voices into existing language group
          if (lg.lyricPath && !existing.lyricPath) existing.lyricPath = lg.lyricPath;
          if (lg.guidePaths) existing.guidePaths = [...(existing.guidePaths ?? []), ...lg.guidePaths];
        }
        for (const vg of lg.voices) {
          let existingVoice = existing.voices.find((v) => v.voice === vg.voice);
          if (!existingVoice) {
            existing.voices.push({ voice: vg.voice, files: [...vg.files] });
          } else {
            existingVoice.files.push(...vg.files);
          }
        }
      }
      results.delete(item.songId);
      break;
    }
  }

  // Ensure every song has at least one language marked as original
  for (const item of results.values()) {
    const hasOriginal = item.languages.some((l) => l.isOriginal);
    if (!hasOriginal && item.languages.length > 0) {
      // Prefer the first non-instrumental language, otherwise the first language
      const preferred = item.languages.find((l) => l.lang !== "instrumental");
      (preferred ?? item.languages[0]).isOriginal = true;
    }
  }

  return Array.from(results.values()).sort((a, b) => a.title.localeCompare(b.title));
}

async function checkExisting(songId: string): Promise<boolean> {
  const { getSong } = await import("@/lib/content");
  try {
    await getSong(songId);
    return true;
  } catch {
    return false;
  }
}

export function getMusicDir(): string {
  return MUSIC_DIR();
}
