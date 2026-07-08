import { z } from 'zod';

export const ReferenceSchema = z.object({
  type: z.string(),
  label: z.string(),
  target: z.string(),
  line: z.number().optional(),
  verse: z.string().optional(),      // matches {start_of_verse: <value>} in .cho
  chorus: z.string().optional(),     // matches {start_of_chorus: <value>} in .cho
});

export const SongMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  tags: z.array(z.string()).default([]),
  key: z.string().optional(),
  tempo: z.number().optional(),
  ccli: z.string().optional(),
  created: z.union([z.string(), z.date()]).optional(),
  references: z.array(ReferenceSchema).default([]),
});

export type SongMeta = z.infer<typeof SongMetaSchema>;
export type Reference = z.infer<typeof ReferenceSchema>;

export const AlbumSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),                  // required — artist ID
  year: z.number().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  songs: z.array(z.string()).default([]),
  created: z.union([z.string(), z.date()]).optional(),
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
  translator: z.string().nullable().optional(),
  status: z.enum(['draft', 'review', 'final']).default('draft'),
  published: z.boolean().default(false),
  lastModified: z.string().optional(),
  modifiedBy: z.string().optional(),
});

export type SongTranslationFrontmatter = z.infer<typeof SongTranslationFrontmatterSchema>;

export const LanguageConfigSchema = z.object({
  code: z.string(),
  label: z.string(),
  rtl: z.boolean().default(false),
});

export type LanguageConfig = z.infer<typeof LanguageConfigSchema>;

export const LanguagesConfigSchema = z.object({
  languages: z.array(LanguageConfigSchema),
  default: z.string(),
});

export type LanguagesConfig = z.infer<typeof LanguagesConfigSchema>;

export const SiteConfigSchema = z.object({
  title: z.string(),
  defaultLanguage: z.string(),
  pdfPageSize: z.string().default('A4'),
  enableArtistPages: z.boolean().default(true),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;
