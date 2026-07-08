import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  passwordHash: z.string(),
  role: z.enum(['public', 'reviewer', 'admin']),
  displayName: z.string().optional(),
  created: z.union([z.string(), z.date()]).optional(),
});

export type User = z.infer<typeof UserSchema>;

export const roles = ['public', 'reviewer', 'admin'] as const;
export type Role = (typeof roles)[number];

// What each role can do:
// public: read songs, albums, artists, browse, compare, present, print
// reviewer: all public + edit songs, create translations
// admin: all reviewer + create/delete songs/albums/artists, manage users
