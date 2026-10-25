import { youtubeIdFromUrl, youtubePlaylistIdFromUrl } from "@/lib/youtube";
import { EmbedFrame } from '@/components/OpenInNewTabButton';

export function YouTubePlayer({
  url,
  title,
  variant = "full",
  isPlaylist = false,
}: {
  url: string;
  title?: string;
  variant?: "full" | "compact" | "large";
  isPlaylist?: boolean;
}) {
  const playlistId = isPlaylist ? youtubePlaylistIdFromUrl(url) : null;
  const videoId = playlistId ? null : youtubeIdFromUrl(url);
  if (!playlistId && !videoId) return null;
  const src = playlistId
    ? `https://www.youtube.com/embed/videoseries?list=${playlistId}`
    : `https://www.youtube.com/embed/${videoId}`;
  const height = variant === "compact" ? 112 : variant === "large" ? 360 : 180;
  const openUrl = playlistId
    ? `https://www.youtube.com/playlist?list=${playlistId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
  return (
    <EmbedFrame
      href={openUrl}
      variant={variant === "compact" ? "icon" : "label"}
      className={variant === "compact" ? "w-64 max-w-full" : "max-w-full"}
    >
    <iframe
      src={src}
      width="100%"
      height={height}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
      title={title ?? "YouTube"}
      className="max-w-full w-full rounded-lg"
    />
    </EmbedFrame>
  );
}