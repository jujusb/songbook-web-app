import { redirect } from 'next/navigation';
import { getSession, canEdit } from '@/lib/auth';
import { getLanguagesConfig, listSongs } from '@/lib/content';
import { PublicationStatus } from '@/components/PublicationStatus';

export default async function PublicationStatusPage() {
  const session = await getSession();
  if (!canEdit(session?.role ?? null)) redirect('/login');
  const [langConfig, songs] = await Promise.all([
    getLanguagesConfig(),
    listSongs({ onlyPublished: false, role: 'admin' }),
  ]);
  return <PublicationStatus songs={songs} languages={langConfig.languages} defaultLanguage={langConfig.default} />;
}