export function spotifySearchUrl(query: string, type?: "tracks" | "albums" | "artists"): string {
  const base = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
  return type ? `${base}/${type}` : base;
}

export function spotifySongSearchUrl(title: string, artist?: string): string {
  return spotifySearchUrl([artist, title].filter(Boolean).join(" "), "tracks");
}