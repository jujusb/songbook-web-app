import { z } from 'zod';

export const NavidromeConfigSchema = z.object({
  songsUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export type NavidromeConfig = z.infer<typeof NavidromeConfigSchema>;

/**
 * Read the Navidrome configuration from the environment.
 * Returns null when the feature is disabled (any var missing/invalid),
 * in which case no Navidrome calls are made and no UI is rendered.
 */
export function getNavidromeConfig(): NavidromeConfig | null {
  const songsUrl = process.env.SONGBOOK_NAVIDROME_SONGS_URL;
  const username = process.env.SONGBOOK_NAVIDROME_USERNAME;
  const password = process.env.SONGBOOK_NAVIDROME_PASSWORD;
  if (!songsUrl || !username || !password) return null;
  try {
    return NavidromeConfigSchema.parse({ songsUrl, username, password });
  } catch {
    return null;
  }
}