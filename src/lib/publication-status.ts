import { getLanguagesConfig, listSongs, type SongListItem } from '@/lib/content';

export interface PublicationLanguageStatus {
  present: boolean;
  published: boolean;
  chordsPublished: boolean;
}

export interface PublicationStatusRow {
  songId: string;
  title: string;
  languages: Record<string, PublicationLanguageStatus>;
}

export interface PublicationStatusResult {
  languages: string[];
  defaultLanguage: string;
  rows: PublicationStatusRow[];
}

export async function getPublicationStatus(
  options: { role?: 'public' | 'reviewer' | 'admin' | 'setlist_creator' } = {},
): Promise<PublicationStatusResult> {
  const role = options.role ?? 'admin';
  const [langConfig, songs] = await Promise.all([
    getLanguagesConfig(),
    listSongs({ onlyPublished: false, role }),
  ]);
  const languages = langConfig.languages;
  const rows: PublicationStatusRow[] = songs
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((song: SongListItem) => {
      const languagesMap: Record<string, PublicationLanguageStatus> = {};
      for (const lang of languages) {
        const present = (song.translations ?? []).includes(lang);
        languagesMap[lang] = {
          present,
          published: present && song.published?.[lang] === true,
          chordsPublished: present && song.chordsPublished?.[lang] === true,
        };
      }
      return {
        songId: song.id,
        title: song.title,
        languages: languagesMap,
      };
    });
  return { languages, defaultLanguage: langConfig.default, rows };
}

export const collectPublicationStatus = getPublicationStatus;
export const collectPublication = getPublicationStatus;
export const getPublication = getPublicationStatus;
export const getPublicationMatrix = getPublicationStatus;
export const getPublicationReport = getPublicationStatus;