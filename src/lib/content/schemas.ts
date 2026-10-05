import { z } from 'zod';

export const ReferenceLocationSchema = z.object({
  line: z.number().optional(),
  verse: z.string().optional(),
  chorus: z.string().optional(),
  highlight: z.string().optional(),  // per-location override of the reference-level highlight
  highlights: z.record(z.string(), z.string()).optional(), // language-keyed highlight
});

export type ReferenceLocation = z.infer<typeof ReferenceLocationSchema>;

export const ReferenceSchema = z.object({
  type: z.string(),
  label: z.string(),
  target: z.string(),
  line: z.number().optional(),
  verse: z.string().optional(),      // matches {start_of_verse: <value>} in .cho
  chorus: z.string().optional(),     // matches {start_of_chorus: <value>} in .cho
  text: z.string().optional(),       // full text of the reference (e.g. Bible verse content)
  texts: z.record(z.string(), z.string()).optional(), // language-keyed reference text
  highlight: z.string().optional(),  // substring within `text` to highlight as directly relevant
  highlights: z.record(z.string(), z.string()).optional(), // language-keyed highlight
  locations: z.array(ReferenceLocationSchema).optional(), // multiple anchors in the song
});

export const AudioFileSchema = z.object({
  lang: z.string(),
  voice: z.string(),                 // e.g. "masculine-alto", "masculine-bajo", "feminine-alto", "feminine-bajo"
  path: z.string(),                  // relative URL path, e.g. "/music/amazing-grace/fr/masculine-alto.mp3"
});

export type AudioFile = z.infer<typeof AudioFileSchema>;

export const SpotifyLinksSchema = z.object({
  song: z
    .string()
    .refine((u) => u.startsWith('https://open.spotify.com/'), {
      message: 'Spotify song URL must start with https://open.spotify.com/',
    })
    .optional(),
});

export type SpotifyLinks = z.infer<typeof SpotifyLinksSchema>;

export const PartitionSchema = z.object({
  instrument: z.string(),              // slug of the instrument folder, e.g. "cuerdas"
  instrumentLabel: z.string().optional(), // display label for the instrument folder
  file: z.string(),                    // relative path under the partitions root
  title: z.string().optional(),        // decoded PDF basename (without extension) for display
});

export type Partition = z.infer<typeof PartitionSchema>;

export const SongMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  titles: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).default([]),
  key: z.string().optional(),
  capo: z.number().optional(),
  tempo: z.number().optional(),
  ccli: z.string().optional(),
  created: z.union([z.string(), z.date()]).optional(),
  references: z.array(ReferenceSchema).default([]),
  audioFiles: z.array(AudioFileSchema).default([]),
  partitions: z.array(PartitionSchema).default([]),
  spotify: SpotifyLinksSchema.optional(),
  youtube: z
    .string()
    .refine((u) => u.startsWith('https://www.youtube.com/') || u.startsWith('https://youtu.be/'), {
      message: 'YouTube URL must start with https://www.youtube.com/ or https://youtu.be/',
    })
    .optional(),
});

export type SongMeta = z.infer<typeof SongMetaSchema>;
export type Reference = z.infer<typeof ReferenceSchema>;

export const AlbumSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),                  // required — artist ID
  year: z.number().optional(),
  number: z.number().optional(),       // album number for ordering/sorting
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  songs: z.array(z.string()).default([]),
  titles: z.record(z.string(), z.string()).optional(),
  created: z.union([z.string(), z.date()]).optional(),
  spotify: z
    .string()
    .refine((u) => u.startsWith('https://open.spotify.com/'), {
      message: 'Spotify album URL must start with https://open.spotify.com/',
    })
    .optional(),      // Spotify album URL
  youtube: z
    .string()
    .refine((u) => u.startsWith('https://www.youtube.com/') || u.startsWith('https://youtu.be/'), {
      message: 'YouTube URL must start with https://www.youtube.com/ or https://youtu.be/',
    })
    .optional(),
  youtubePlaylist: z
    .string()
    .refine((u) => u.startsWith('https://www.youtube.com/') || u.startsWith('https://youtu.be/'), {
      message: 'YouTube playlist URL must start with https://www.youtube.com/ or https://youtu.be/',
    })
    .optional(),
  published: z.boolean().default(false),
});

export type Album = z.infer<typeof AlbumSchema>;

export const ArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  bio: z.string().optional(),
  website: z.string().optional(),
  tags: z.array(z.string()).default([]),
  created: z.union([z.string(), z.date()]).optional(),
});

export type Artist = z.infer<typeof ArtistSchema>;

export const SongTranslationFrontmatterSchema = z.object({
  language: z.string(),
  title: z.string().optional(),
  translator: z.string().nullable().optional(),
  status: z.enum(['draft', 'review', 'final']).default('draft'),
  published: z.boolean().default(false),
  lastModified: z.string().optional(),
  modifiedBy: z.string().optional(),
});

export type SongTranslationFrontmatter = z.infer<typeof SongTranslationFrontmatterSchema>;

export const LanguagesConfigSchema = z.object({
  languages: z.array(z.string()),
  default: z.string(),
});

export type LanguagesConfig = z.infer<typeof LanguagesConfigSchema>;

export const OidcRoleMappingSchema = z.object({
  admin: z.union([z.string(), z.array(z.string())]).optional(),
  reviewer: z.union([z.string(), z.array(z.string())]).optional(),
});

export type OidcRoleMapping = z.infer<typeof OidcRoleMappingSchema>;

export const OidcConfigSchema = z.object({
  enabled: z.boolean().default(false),
  issuer: z.string(),                                    // e.g. https://auth.example.com/realms/main
  clientId: z.string(),
  scopes: z.array(z.string()).default(['openid', 'profile', 'email']),
  roleClaim: z.string().default('groups'),               // JWT claim holding role/group info
  roleMapping: OidcRoleMappingSchema.optional(),         // map claim values → songbook roles
  defaultRole: z.enum(['public', 'reviewer', 'admin']).default('public'),
  buttonLabel: z.string().default('Sign in with SSO'),
  autoRedirect: z.boolean().default(false),              // skip login form, go straight to OIDC
  logoutUrl: z.string().optional(),                      // OIDC provider logout endpoint
});

export type OidcConfig = z.infer<typeof OidcConfigSchema>;

export const SiteConfigSchema = z.object({
  title: z.string(),
  defaultLanguage: z.string(),
  pdfPageSize: z.string().default('A4'),
  enableArtistPages: z.boolean().default(true),
  oidc: OidcConfigSchema.optional(),
  /** Base URL of the read-only/public instance, used for setlist share links. */
  publicUrl: z.string().optional(),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;

// --- Setlists ---

export const SetlistItemSchema = z.object({
  songId: z.string(),
  lang: z.string(),                // language to present
});

export type SetlistItem = z.infer<typeof SetlistItemSchema>;

export const VoiceShareSectionSchema = z.enum(['tenor', 'bass', 'alto', 'soprano']);
export type VoiceShareSection = z.infer<typeof VoiceShareSectionSchema>;

/** A generated Navidrome share for one voice section of a setlist. */
export const VoiceShareSchema = z.object({
  section: VoiceShareSectionSchema,
  url: z.string(),
  count: z.number().int().nonnegative().default(0),
  /** Whether the share page allows embedding in an iframe. */
  embeddable: z.boolean().default(false),
});

export type VoiceShare = z.infer<typeof VoiceShareSchema>;

export const SetlistSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  date: z.string().optional(),               // e.g. service date "2025-07-13"
  songs: z.array(SetlistItemSchema).default([]),
  voiceShares: z.array(VoiceShareSchema).default([]),  // per-voice Navidrome shares
  public: z.boolean().default(false),        // browsable by anyone (private by default)
  shareToken: z.string().optional(),         // grants view access via ?share=<token>
  shareSlug: z.string().optional(),          // optional custom slug for the share link
  ownerId: z.string().optional(),            // user who created the setlist
  created: z.union([z.string(), z.date()]).optional(),
  modified: z.union([z.string(), z.date()]).optional(),
});

export type Setlist = z.infer<typeof SetlistSchema>;
