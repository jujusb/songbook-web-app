"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface VoiceGroup {
  voice: string;
  files: { voice: string; path: string; label: string }[];
}

interface LanguageGroup {
  lang: string;
  isOriginal: boolean;
  album?: string;
  title?: string;
  voices: VoiceGroup[];
  guidePaths?: string[];
}

interface ScanItem {
  songId: string;
  title: string;
  existing: boolean;
  languages: LanguageGroup[];
}

interface AlbumGroup {
  albumName: string;
  albumNumber: string | null;
  songs: {
    songNumber: string | null;
    songId: string;
    title: string;
    existing: boolean;
    languages: LanguageGroup[];
  }[];
}

interface SubdirConfig {
  dirName: string;
  role: "voice" | "album" | "guide" | "skip";
  voiceName: string;
}

interface FolderConfig {
  dirName: string;
  relPath: string;
  lang: string;
  isOriginal: boolean;
  nestedLanguages: boolean;
  subdirs: SubdirConfig[];
}

interface BrowseResult {
  dirs: string[];
  hasSubdirs: string[];
}

const LANGUAGES = ["en", "es", "fr", "pt", "de", "it", "la", "instrumental"];
const LANG_CODES = new Set(LANGUAGES);

function looksLikeLanguages(subdirs: string[]): boolean {
  return subdirs.length > 0 && subdirs.every((s) => LANG_CODES.has(s.toLowerCase()));
}

function hasVoiceName(name: string): boolean {
  const lower = name.toLowerCase();
  return /voces|voices|vocals|voci|cantantes|cantores|coro|choir/i.test(lower);
}

const VOICE_OPTIONS = [
  "tenor",
  "bass",
  "all masculine",
  "alto",
  "soprane",
  "all girls",
] as const;

const VOICE_LABELS: Record<string, string> = {
  "feminine-alto": "Fem. Alto",
  "feminine-bajo": "Fem. Bajo",
  "masculine-alto": "Masc. Alto",
  "masculine-bajo": "Masc. Bajo",
  feminine: "Feminine",
  masculine: "Masculine",
  guide: "Guide",
  all: "All",
  full: "Full",
  tenor: "Tenor",
  bass: "Bass",
  "all masculine": "All Masc.",
  alto: "Alto",
  soprane: "Soprane",
  "all girls": "All Girls",
};

const VOICE_COLORS: Record<string, string> = {
  "feminine-alto": "bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300",
  "feminine-bajo": "bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300",
  "masculine-alto": "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  "masculine-bajo": "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  feminine: "bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300",
  masculine: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  guide: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
  all: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300",
  full: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400",
  tenor: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  bass: "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300",
  "all masculine": "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  alto: "bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300",
  soprane: "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300",
  "all girls": "bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300",
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function MusicImportClient() {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState("");
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [loadingBrowse, setLoadingBrowse] = useState(true);
  const [addedPaths, setAddedPaths] = useState<string[]>([]);
  const [folderConfigs, setFolderConfigs] = useState<FolderConfig[]>([]);
  const [scanResult, setScanResult] = useState<ScanItem[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<string[]>([]);
  const [artistName, setArtistName] = useState("");
  const [artistList, setArtistList] = useState<{ id: string; name: string }[]>([]);
  const [showArtistDropdown, setShowArtistDropdown] = useState(false);
  const [configJson, setConfigJson] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingBrowse(true);
      try {
        const { browseMusicDirAction, listArtistsAction } = await import("@/app/actions");
        const [result, artists] = await Promise.all([
          browseMusicDirAction(),
          listArtistsAction(),
        ]);
        if (!cancelled) {
          setBrowseResult(result);
          setCurrentPath("");
          setArtistList(artists);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Browse failed:", err);
          setBrowseResult(null);
        }
      } finally {
        if (!cancelled) setLoadingBrowse(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadDir = useCallback(async (path: string) => {
    setLoadingBrowse(true);
    try {
      const { browseMusicDirAction } = await import("@/app/actions");
      const result = await browseMusicDirAction(path || undefined);
      setBrowseResult(result);
      setCurrentPath(path);
    } catch (err) {
      console.error("Browse failed:", err);
      setBrowseResult(null);
    } finally {
      setLoadingBrowse(false);
    }
  }, []);

  const addFolder = useCallback(async (dirName: string) => {
    const relPath = currentPath ? `${currentPath}/${dirName}` : dirName;
    if (addedPaths.includes(relPath)) return;

    const { browseMusicDirAction } = await import("@/app/actions");
    const subResult = await browseMusicDirAction(relPath);
    const subdirNames = subResult?.dirs ?? [];

    const nested = looksLikeLanguages(subdirNames);
    const isOrig = hasVoiceName(dirName) || subdirNames.some((s) => hasVoiceName(s));

    setAddedPaths((prev) => [...prev, relPath]);
    setFolderConfigs((prev) => {
      const entry: FolderConfig = {
        dirName,
        relPath,
        lang: LANG_CODES.has(dirName.toLowerCase()) ? dirName.toLowerCase() : "es",
        isOriginal: isOrig,
        nestedLanguages: nested,
        subdirs: subdirNames.map((s) => ({
          dirName: s,
          role: hasVoiceName(s) ? "voice" : "album",
          voiceName: s,
        })),
      };
      return [...prev, entry];
    });
  }, [currentPath, addedPaths]);

  const removeFolder = useCallback((relPath: string) => {
    setAddedPaths((prev) => prev.filter((p) => p !== relPath));
    setFolderConfigs((prev) => prev.filter((fc) => fc.relPath !== relPath));
  }, []);

  const updateFolder = useCallback(
    (idx: number, patch: Partial<FolderConfig>) => {
      setFolderConfigs((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      });
    },
    [],
  );

  const cycleSubdirRole = useCallback(
    (folderIdx: number, subdirIdx: number) => {
      setFolderConfigs((prev) => {
        const next = [...prev];
        const subdirs = [...next[folderIdx].subdirs];
        const sd = subdirs[subdirIdx];
        const order: SubdirConfig["role"][] = ["album", "voice", "guide", "skip"];
        const nextRole = order[(order.indexOf(sd.role) + 1) % order.length];
        subdirs[subdirIdx] = { ...sd, role: nextRole };
        next[folderIdx] = { ...next[folderIdx], subdirs };
        return next;
      });
    },
    [],
  );

  const updateSubdirVoice = useCallback(
    (folderIdx: number, subdirIdx: number, voiceName: string) => {
      setFolderConfigs((prev) => {
        const next = [...prev];
        const subdirs = [...next[folderIdx].subdirs];
        subdirs[subdirIdx] = { ...subdirs[subdirIdx], voiceName };
        next[folderIdx] = { ...next[folderIdx], subdirs };
        return next;
      });
    },
    [],
  );

  const handleScan = useCallback(async () => {
    if (folderConfigs.length === 0) return;
    setScanning(true);
    setScanResult(null);
    try {
      const { scanMusicDirectoryAction } = await import("@/app/actions");
      const json = JSON.stringify({
        folders: folderConfigs.map((fc) => {
          const entry: Record<string, unknown> = {
            dirName: fc.relPath,
            lang: fc.lang,
            isOriginal: fc.isOriginal,
            nestedLanguages: fc.nestedLanguages,
          };
          entry.voiceDirs = fc.subdirs
            .filter((sd) => sd.role === "voice")
            .map((sd) => ({ dirName: sd.dirName, voice: sd.voiceName }));
          entry.guideDirs = fc.subdirs
            .filter((sd) => sd.role === "guide")
            .map((sd) => ({ dirName: sd.dirName, voice: sd.voiceName }));
          entry.albumDirs = fc.subdirs
            .filter((sd) => sd.role === "album")
            .map((sd) => sd.dirName);
          return entry;
        }),
      });
      setConfigJson(json);
      const result = await scanMusicDirectoryAction(json);
      setScanResult(result);
    } catch (err) {
      console.error("Scan failed:", err);
    } finally {
      setScanning(false);
    }
  }, [folderConfigs]);

  const handleImport = useCallback(async (songId: string) => {
    setImporting(songId);
    try {
      const { importMusicAction } = await import("@/app/actions");
      await importMusicAction(songId, configJson || undefined, artistName || undefined);
      setImported((prev) => [...prev, songId]);
      router.refresh();
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setImporting(null);
    }
  }, [router, configJson, artistName]);

  const handleBatchImport = useCallback(async (songIds: string[]) => {
    const { importMusicAction } = await import("@/app/actions");
    for (const songId of songIds) {
      setImporting(songId);
      try {
        await importMusicAction(songId, configJson || undefined, artistName || undefined);
        setImported((prev) => [...prev, songId]);
        router.refresh();
      } catch (err) {
        console.error(`Import failed for ${songId}:`, err);
      }
    }
    setImporting(null);
  }, [router, configJson, artistName]);

  function groupResults(items: ScanItem[]): AlbumGroup[] {
    const map = new Map<string, { items: ScanItem[]; albumNames: Set<string> }>();
    for (const item of items) {
      const fallbackAlbum = item.languages[0]?.album || "";
      const albumNumber = extractNumber2(item.songId) || extractNumber2(fallbackAlbum);
      const key = albumNumber || fallbackAlbum || "(no album)";
      if (!map.has(key)) map.set(key, { items: [], albumNames: new Set() });
      const entry = map.get(key)!;
      entry.items.push(item);
      for (const lg of item.languages) {
        if (lg.album) entry.albumNames.add(lg.album);
      }
    }

    const groups: AlbumGroup[] = [];
    for (const [key, { items: albumItems, albumNames }] of map) {
      const albumNumber = /^\d+$/.test(key) ? key : extractNumber2(key);
      // Pick the most common album name across all items in this group
      const nameCounts = new Map<string, number>();
      for (const item of albumItems) {
        for (const lg of item.languages) {
          if (lg.album) nameCounts.set(lg.album, (nameCounts.get(lg.album) ?? 0) + 1);
        }
      }
      const albumName = nameCounts.size > 0
        ? [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : key;
      const sorted = [...albumItems].sort((x, y) => {
        const xn = extractSongNumber(x.songId);
        const yn = extractSongNumber(y.songId);
        if (xn !== null && yn !== null) {
          const diff = xn - yn;
          if (diff !== 0) return diff;
        } else if (xn !== null) return -1;
        else if (yn !== null) return 1;
        return x.title.localeCompare(y.title);
      });
      groups.push({
        albumName,
        albumNumber,
        songs: sorted.map((s) => ({
          songNumber: extractSongNumber(s.songId)?.toString() ?? null,
          songId: s.songId,
          title: s.title,
          existing: s.existing,
          languages: s.languages,
        })),
      });
    }
    groups.sort((a, b) => {
      if (a.albumNumber !== null && b.albumNumber !== null) {
        const diff = parseInt(a.albumNumber, 10) - parseInt(b.albumNumber, 10);
        if (diff !== 0) return diff;
      } else if (a.albumNumber !== null) return -1;
      else if (b.albumNumber !== null) return 1;
      return a.albumName.localeCompare(b.albumName);
    });
    return groups;
  }

  function extractNumber2(name: string): string | null {
    const m = name.match(/^(\d+)/);
    return m ? m[1] : null;
  }

  function extractSongNumber(songId: string): number | null {
    const m = songId.match(/^\d+-(\d+)$/);
    if (m) return parseInt(m[1], 10);
    return null;
  }

  /* ---- Loading state ---- */
  if (loadingBrowse) {
    return <p className="text-sm text-neutral-500 mt-4">Loading directories…</p>;
  }

  /* ---- No music dir ---- */
  if (browseResult === null) {
    return (
      <p className="text-sm text-neutral-500 mt-4">
        Music directory not found. Set{" "}
        <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">MUSIC_DIR</code>{" "}
        env var to your music folder.
      </p>
    );
  }

  return (
    <div>
      {/* ---- Artist name ---- */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1 text-neutral-500">
          Artist <span className="text-neutral-400 font-normal">(select existing or type new)</span>
        </label>
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            onFocus={() => setShowArtistDropdown(true)}
            onBlur={() => setTimeout(() => setShowArtistDropdown(false), 150)}
            placeholder="e.g. Hillsong"
            className="border border-neutral-300 dark:border-neutral-700 rounded px-3 py-2 text-sm bg-white dark:bg-neutral-900 w-full"
          />
          {showArtistDropdown && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {artistList
                .filter((a) => !artistName || a.name.toLowerCase().includes(artistName.toLowerCase()))
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setArtistName(a.name); setShowArtistDropdown(false); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {a.name}
                  </button>
                ))}
              {artistList.length === 0 && (
                <p className="px-3 py-2 text-xs text-neutral-400">No existing artists found.</p>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          Used when creating new albums during import.
        </p>
      </div>

      {/* ---- Directory browser ---- */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Browse directories</h2>
        <p className="text-sm text-neutral-500 mb-3">
          Navigate to a folder and click <strong>Add</strong> to include it in the scan.
        </p>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3">
          {/* Breadcrumb / current path */}
          <div className="flex items-center gap-2 text-sm mb-2 text-neutral-500">
            <span className="font-medium">MUSIC_DIR</span>
            {currentPath && <span className="font-mono">/ {currentPath}</span>}
          </div>

          {/* Directory listing */}
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {currentPath && (
              <button
                type="button"
                onClick={() => {
                  const parts = currentPath.split("/");
                  parts.pop();
                  loadDir(parts.join("/"));
                }}
                className="flex items-center gap-2 w-full text-left px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
              >
                <span className="text-neutral-400">&#8593;</span> ..
              </button>
            )}
            {browseResult.dirs.map((dir) => {
              const relPath = currentPath ? `${currentPath}/${dir}` : dir;
              const isAdded = addedPaths.includes(relPath);
              return (
                <div
                  key={dir}
                  className="flex items-center justify-between px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded group"
                >
                  <button
                    type="button"
                    onClick={() => loadDir(currentPath ? `${currentPath}/${dir}` : dir)}
                    className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 min-w-0"
                  >
                    <span className="text-amber-500 shrink-0">&#128193;</span>
                    <span className="truncate">{dir}</span>
                    {browseResult.hasSubdirs.includes(dir) && (
                      <span className="text-[10px] text-neutral-400 shrink-0">&rsaquo;</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => (isAdded ? removeFolder(relPath) : addFolder(dir))}
                    className={`text-xs px-2 py-0.5 rounded shrink-0 transition-colors ${
                      isAdded
                        ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900"
                        : "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900"
                    }`}
                  >
                    {isAdded ? "Remove" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- Folder configuration ---- */}
      {folderConfigs.length > 0 && (
        <div className="space-y-3 mb-6">
          <h2 className="text-lg font-semibold">Folder mapping</h2>
          <p className="text-sm text-neutral-500">
            Configure each added folder&apos;s language, voice parts, and subdirectory roles.
          </p>
          {folderConfigs.map((fc, fi) => (
            <div
              key={fc.relPath}
              className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4"
            >
              {/* Folder header row */}
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-mono text-sm font-semibold min-w-[9rem]">{fc.relPath}</span>

                <label className="flex items-center gap-1.5 text-sm">
                  <span className="text-neutral-500">Language:</span>
                  <select
                    value={fc.lang}
                    onChange={(e) => updateFolder(fi, { lang: e.target.value })}
                    className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-900"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fc.isOriginal}
                    onChange={(e) => updateFolder(fi, { isOriginal: e.target.checked })}
                    className="accent-blue-600"
                  />
                  <span className="text-neutral-500">Original</span>
                </label>

                <button
                  type="button"
                  onClick={() => removeFolder(fc.relPath)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors ml-auto"
                >
                  Remove
                </button>
              </div>

              {/* Subdirectory list */}
              {fc.subdirs.length > 0 && (
                <div className="mt-3 ml-2 space-y-1.5">
                  <span className="text-xs text-neutral-400 uppercase tracking-wider font-medium">
                    Subdirectories
                  </span>
                  {fc.subdirs.map((sd, si) => (
                    <div key={sd.dirName} className="flex items-center gap-3 text-sm flex-wrap">
                      <span className={`font-mono min-w-[8rem] ${sd.role === "skip" ? "text-neutral-300 dark:text-neutral-600 line-through" : "text-neutral-600 dark:text-neutral-400"}`}>
                        {sd.dirName}/
                      </span>

                      <button
                        type="button"
                        onClick={() => cycleSubdirRole(fi, si)}
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                        sd.role === "voice"
                          ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700"
                          : sd.role === "album"
                          ? "bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700"
                          : sd.role === "guide"
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-neutral-200 dark:border-neutral-700"
                      }`}
                    >
                      {sd.role === "voice" ? "Voice" : sd.role === "album" ? "Album" : sd.role === "guide" ? "Guide" : "Skip"}
                      </button>

                      {sd.role === "voice" && (
                        <>
                          <span className="text-neutral-400">&rarr;</span>
                          <select
                            value={sd.voiceName}
                            onChange={(e) => updateSubdirVoice(fi, si, e.target.value)}
                            className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-900 max-w-xs"
                          >
                            {VOICE_OPTIONS.map((v) => (
                              <option key={v} value={v}>{VOICE_LABELS[v] || v}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* ---- Scan button ---- */}
          <button
            onClick={handleScan}
            disabled={scanning || !artistName.trim() || folderConfigs.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {scanning ? "Scanning…" : "Scan folders"}
          </button>
        </div>
      )}

      {folderConfigs.length === 0 && !loadingBrowse && (
        <p className="text-sm text-neutral-400 mb-6">
          Add folders above to configure scan mappings.
        </p>
      )}

      {/* ---- Scan results ---- */}
      {scanResult !== null && (
        <div className="mt-6">
          {scanResult.length === 0 ? (
            <p className="text-neutral-500 text-sm">
              No audio files found for the mapped folders.
            </p>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-neutral-500">
                  Found {scanResult.length} song{scanResult.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={() => handleBatchImport(scanResult.map((s) => s.songId))}
                  disabled={importing !== null}
                  className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {importing !== null ? "Importing…" : "Import all songs"}
                </button>
              </div>

              {groupResults(scanResult).map((group) => {
                const allImported = group.songs.every((s) => imported.includes(s.songId));
                const anyImporting = group.songs.some((s) => importing === s.songId);
                return (
                  <div key={group.albumName} className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        {group.albumName}
                        <span className="text-neutral-400 font-normal ml-2">
                          ({group.songs.length} song{group.songs.length !== 1 ? "s" : ""})
                        </span>
                      </h3>
                      {!allImported && (
                        <button
                          onClick={() => handleBatchImport(group.songs.map((s) => s.songId))}
                          disabled={anyImporting}
                          className="text-xs px-3 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-md font-medium hover:bg-neutral-300 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                        >
                          {anyImporting ? "Importing…" : "Import all"}
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {group.songs.map((song) => (
                        <div key={song.songId} className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="font-semibold">{song.languages.find((l) => l.isOriginal && l.title)?.title ?? song.title}</div>
                              <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                                <code className="text-xs">{song.songId}</code>
                                {song.existing && (
                                  <span className="text-green-600 dark:text-green-400">&check; exists</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleImport(song.songId)}
                              disabled={importing === song.songId}
                              className="text-sm px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
                            >
                              {importing === song.songId
                                ? "Importing…"
                                : imported.includes(song.songId)
                                ? "Imported"
                                : "Import"}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-4 mt-3 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                            {[...song.languages].sort((a, b) => (a.isOriginal === b.isOriginal ? 0 : a.isOriginal ? -1 : 1)).map((ln) => (
                              <div key={ln.lang}>
                                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1">
                                  {ln.lang}
                                  {ln.isOriginal && (
                                    <span className="text-amber-500 ml-1 text-[10px]">original</span>
                                  )}
                                </span>
                                {ln.title && (
                                  <span className="text-xs text-neutral-700 dark:text-neutral-300 block mb-1">
                                    {ln.title}
                                  </span>
                                )}
                                {ln.album && ln.album !== group.albumName && (
                                  <span className="text-[10px] text-neutral-400 block -mt-0.5 mb-1 italic">
                                    {ln.album}
                                  </span>
                                )}
                                <div className="flex flex-wrap gap-1">
                                  {ln.voices.map((vg) => (
                                    <span
                                      key={vg.voice}
                                      className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                                        VOICE_COLORS[vg.voice] || "bg-neutral-100 dark:bg-neutral-800"
                                      }`}
                                    >
                                      {VOICE_LABELS[vg.voice] || vg.voice}
                                      <span className="ml-1 opacity-60">{vg.files.length}</span>
                                    </span>
                                  ))}
                                  {ln.guidePaths && ln.guidePaths.length > 0 && (
                                    <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                                      &#128196; {ln.guidePaths.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
