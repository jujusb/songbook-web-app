import { NextResponse } from 'next/server';
import {
  getAlbum,
  getAlbumTitle,
  getArtist,
  getArtistForSong,
  getSongTitle,
} from '@/lib/content';
import { searchSpotify, type SpotifyItem } from '@/lib/spotify/api';
import { getSpotifyConfig } from '@/lib/spotify/config';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * Look up the Spotify track/album for a song (or album) shown in `lang` and
 * return its Spotify URL/id for embedding. Returns `data: null` when no good
 * match is found. Requires SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET.
 */
export async function POST(req: Request) {
  let body: { type?: string; id?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_body' });
  }

  const { type, id, lang } = body;
  if ((type !== 'song' && type !== 'album') || !id || !lang) {
    return json({ ok: false, error: 'invalid_params' });
  }
  if (!getSpotifyConfig()) {
    return json({ ok: false, error: 'unconfigured' }, 200);
  }

  try {
    let item: SpotifyItem | null;
    if (type === 'song') {
      const title = await getSongTitle(id, lang);
      const artist = (await getArtistForSong(id))?.name;
      item = await searchSpotify({
        query: `${artist ?? ''} ${title}`.trim(),
        type: 'track',
        title,
        artist,
      });
    } else {
      const album = await getAlbum(id);
      const title = await getAlbumTitle(id, lang);
      const artist = (await getArtist(album.artist)).name;
      item = await searchSpotify({
        query: `${artist} ${title}`.trim(),
        type: 'album',
        title,
        artist,
      });
    }
    return json({ ok: true, data: item });
  } catch {
    return json({ ok: false, error: 'search_failed' });
  }
}