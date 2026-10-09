import { z } from 'zod';

export const PermissionSchema = z.object({
  editSong: z.array(z.object({
    songId: z.string(),
    lang: z.string(),
  })).default([]),
  editAlbum: z.array(z.object({
    albumId: z.string(),
    lang: z.string(),
  })).default([]),
  editLanguage: z.array(z.string()).default([]),
});

export type Permissions = z.infer<typeof PermissionSchema>;

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  passwordHash: z.string().optional(),       // absent for OIDC-only users
  role: z.enum(['public', 'reviewer', 'admin', 'setlist_creator']),
  displayName: z.string().optional(),
  email: z.string().optional(),
  authProvider: z.enum(['local', 'oidc']).default('local'),
  oidcSub: z.string().optional(),            // OIDC subject identifier
  created: z.union([z.string(), z.date()]).optional(),
  permissions: PermissionSchema.optional(),
});

export type User = z.infer<typeof UserSchema>;
export type UserInput = z.input<typeof UserSchema>;

export const roles = ['public', 'reviewer', 'admin', 'setlist_creator'] as const;
export type Role = (typeof roles)[number];

// What each role can do:
// public: read songs, albums, artists, browse, compare, present, print
// setlist_creator: all public + create/edit own setlists, manage share links
// reviewer: all public + edit songs, create translations (can be restricted by permissions)
// admin: all reviewer + create/delete songs/albums/artists, manage users
