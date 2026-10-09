import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSpotifyConfig } from '@/lib/spotify/config';

describe('spotify/config.ts', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when the client id is missing', () => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', '');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'secret');
    expect(getSpotifyConfig()).toBeNull();
  });

  it('returns null when the client secret is missing', () => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'id');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '');
    expect(getSpotifyConfig()).toBeNull();
  });

  it('returns null when both are missing', () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    expect(getSpotifyConfig()).toBeNull();
  });

  it('returns the trimmed credentials when both are set', () => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', '  my-id  ');
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '  my-secret  ');
    expect(getSpotifyConfig()).toEqual({ clientId: 'my-id', clientSecret: 'my-secret' });
  });
});
