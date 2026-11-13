"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

interface Album {
  id: string;
  title: string;
  titles?: Record<string, string>;
  artist: string;
  songCount: number;
}

interface Artist {
  id: string;
  name: string;
}

export function PrintConfigForm({
  albums,
  languages,
  defaultLang,
  preselectedAlbum,
  artists = [],
  preselectedArtist,
}: {
  albums: Album[];
  languages: string[];
  defaultLang: string;
  preselectedAlbum?: string;
  artists?: Artist[];
  preselectedArtist?: string;
}) {
  const router = useRouter();
  const { locale, languageLabel, t } = useTranslation();
  const [scope, setScope] = useState<"all" | "album" | "artist">(
    preselectedAlbum ? "album" : preselectedArtist ? "artist" : "all"
  );
  const [albumId, setAlbumId] = useState(preselectedAlbum || (albums[0]?.id ?? ""));
  const [artistId, setArtistId] = useState(preselectedArtist || (artists[0]?.id ?? ""));
  const [selectedLangs, setSelectedLangs] = useState<string[]>([defaultLang]);
  const [includeRefs, setIncludeRefs] = useState(false);

  const toggleLang = (code: string) => {
    setSelectedLangs((prev) =>
      prev.includes(code)
        ? prev.filter((l) => l !== code)
        : [...prev, code]
    );
  };

  const selectAllLangs = () => {
    setSelectedLangs([...languages]);
  };

  const handlePrint = () => {
    if (selectedLangs.length === 0) return;

    const params = new URLSearchParams();
    if (scope === "album" && albumId) {
      params.set("album", albumId);
    }
    if (scope === "artist" && artistId) {
      params.set("artist", artistId);
    }
    if (includeRefs) {
      params.set("refs", "1");
    }

    // If multiple languages, use "all" as the lang param and pass langs
    let langPath: string;
    if (selectedLangs.length === 1) {
      langPath = selectedLangs[0];
    } else {
      langPath = "all";
      params.set("langs", selectedLangs.join(","));
    }

    const qs = params.toString();
    router.push(`/print/${langPath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="space-y-6">
      {/* Scope */}
      <div>
        <label className="block text-sm font-medium mb-2">{t('printConfig.whatToPrint')}</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={scope === "all"}
              onChange={() => setScope("all")}
              className="accent-blue-600"
            />
            <span className="text-sm">{t('pdf.scopeAll')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={scope === "album"}
              onChange={() => setScope("album")}
              className="accent-blue-600"
            />
            <span className="text-sm">{t('pdf.scopeAlbum')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={scope === "artist"}
              onChange={() => setScope("artist")}
              className="accent-blue-600"
            />
            <span className="text-sm">{t('pdf.scopeArtist')}</span>
          </label>
        </div>
        {scope === "album" && (
          <select
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            className="mt-2 w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {t('printConfig.albumOption', { title: album.titles?.[locale] || album.title, artist: album.artist, count: album.songCount })}
              </option>
            ))}
          </select>
        )}
        {scope === "artist" && (
          <select
            value={artistId}
            onChange={(e) => setArtistId(e.target.value)}
            className="mt-2 w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {artists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Languages */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">{t('pdf.languages')}</label>
          <button
            type="button"
            onClick={selectAllLangs}
            className="text-xs text-blue-600 hover:text-blue-500"
          >
            {t('pdf.selectAll')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {languages.map((lang) => (
            <label
              key={lang}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ${
                selectedLangs.includes(lang)
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                  : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedLangs.includes(lang)}
                onChange={() => toggleLang(lang)}
                className="sr-only"
              />
              {languageLabel(lang)}
            </label>
          ))}
        </div>
        {selectedLangs.length === 0 && (
          <p className="text-xs text-red-500 mt-1">{t('printConfig.selectOneLanguage')}</p>
        )}
      </div>

      {/* Options */}
      <div>
        <label className="text-sm font-medium mb-2 block">{t('printConfig.options')}</label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeRefs}
            onChange={(e) => setIncludeRefs(e.target.checked)}
            className="accent-blue-600"
          />
          <span className="text-sm">{t('pdf.includeReferences')}</span>
        </label>
      </div>

      {/* Action */}
      <button
        type="button"
        onClick={handlePrint}
        disabled={selectedLangs.length === 0}
        className="px-5 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {t('printConfig.generate')}
      </button>

      <p className="text-xs text-neutral-400">
        {t('printConfig.help')}
      </p>
    </div>
  );
}
