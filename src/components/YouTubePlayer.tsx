import { youtubeIdFromUrl, youtubePlaylistIdFromUrl } from "@/lib/youtube";

export function YouTubePlayer({
  url,
  title,
  variant = "full",
  isPlaylist = false,
}: {
  url: string;
  title?: string;
  variant?: "full" | "compact";
  isPlaylist?: boolean;
}) {
  const playlistId = isPlaylist ? youtubePlaylistIdFromUrl(url) : null;
  const videoId = playlistId ? null : youtubeIdFromUrl(url);
  if (!playlistId && !videoId) return null;
  const src = playlistId
    ? `https://www.youtube.com/embed/videoseries?list=${playlistId}`
    : `https://www.youtube.com/embed/${videoId}`;
  return (
    <iframe
      src={src}
      width="100%"
      height={variant === "compact" ? 112 : 180}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
      title={title ?? "YouTube"}
      className={variant === "compact" ? "w-64 max-w-full rounded-lg" : "max-w-full rounded-lg"}
    />
  );
}