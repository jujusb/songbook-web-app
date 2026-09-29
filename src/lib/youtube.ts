/**
 * Extract the YouTube video ID from a variety of accepted URL formats:
 *   https://www.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/shorts/ID
 * Returns null when the URL is not a recognizable YouTube link.
 */
export function youtubeIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  const watch = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watch) return watch[1];
  const short = trimmed.match(/^https:\/\/(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1];
  const embed = trimmed.match(/^https:\/\/(?:www\.)?youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
  if (embed) return embed[1];
  return null;
}

/**
 * Extract the YouTube playlist ID from URLs like:
 *   https://www.youtube.com/playlist?list=ID
 * Returns null when the URL is not a recognizable YouTube playlist link.
 */
export function youtubePlaylistIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  const playlist = trimmed.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (playlist) return playlist[1];
  const playEmbed = trimmed.match(/^https:\/\/(?:www\.)?youtube\.com\/embed\/videoseries\?list=([A-Za-z0-9_-]+)/);
  if (playEmbed) return playEmbed[1];
  return null;
}