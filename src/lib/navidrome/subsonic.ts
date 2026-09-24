import { SubsonicAPI, type AlbumID3, type Child, type Share } from 'subsonic-api';
import type { NavidromeConfig } from './config';

export type SubsonicSong = Child;
export type SubsonicAlbum = AlbumID3;
export type SubsonicShare = Share;

/**
 * Thin wrapper around the `subsonic-api` library. Provides the subset of
 * Subsonic/Navidrome endpoints the songbook needs: search, album lookups,
 * share management, streaming URLs and cover art URLs.
 */
export class SubsonicClient {
  private readonly api: SubsonicAPI;

  constructor(config: NavidromeConfig) {
    // The library's MD5 hashes each char by its low byte, while Navidrome
    // hashes the UTF-8 bytes. Re-encoding the password so each UTF-8 byte maps
    // to a single char (latin1) makes the two agree even for non-ASCII chars.
    const password = Buffer.from(config.password, 'utf8').toString('latin1');
    this.api = new SubsonicAPI({
      url: config.songsUrl,
      auth: { username: config.username, password },
    });
  }

  async search3(opts: {
    query: string;
    songCount?: number;
    albumCount?: number;
    artistCount?: number;
  }): Promise<{ song?: Child[]; album?: AlbumID3[]; artist?: { id: string; name: string }[] }> {
    const res = await this.api.search3({
      query: opts.query,
      songCount: opts.songCount ?? 20,
      albumCount: opts.albumCount ?? 20,
      artistCount: opts.artistCount ?? 5,
    });
    return res.searchResult3 ?? {};
  }

  async getAlbum(id: string): Promise<AlbumID3 & { song?: Child[] }> {
    const res = await this.api.getAlbum({ id });
    return res.album;
  }

  async getShares(): Promise<Share[]> {
    const res = await this.api.getShares();
    return res.shares?.share ?? [];
  }

  async createShare(id: string, description?: string): Promise<Share> {
    const res = await this.api.createShare({ id, description });
    const share = res.shares?.share?.[0];
    if (!share) throw new Error('Navidrome createShare returned no share');
    return share;
  }

  /** Authenticated streaming URL for a media file. */
  async streamUrl(id: string): Promise<string> {
    return this.api.streamURL({ id });
  }

  /** Authenticated cover art URL. */
  async coverArtUrl(id: string, size = 512): Promise<string> {
    return this.api.getCoverArtURL({ id, size });
  }
}