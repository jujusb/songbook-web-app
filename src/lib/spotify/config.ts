export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Spotify Web API credentials. When unset, the Spotify embed player is
 * disabled and the UI falls back to plain Spotify search links.
 */
export function getSpotifyConfig(): SpotifyConfig | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}