import Link from "next/link";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { canCreateSetlist } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { createT } from "@/lib/i18n/server";
import { getLanguagesConfig } from "@/lib/content";

const FEATURES = [
  { key: "chords", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
  { key: "translations", icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" },
  { key: "editor", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { key: "presentation", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { key: "pdf", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
  { key: "setlists", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { key: "voices", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
  { key: "music", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "partitions", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
  { key: "import", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
  { key: "access", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { key: "selfhosted", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
] as const;

export default async function HomePage() {
  const cookieStore = await cookies();
  const langConfig = await getLanguagesConfig().catch(() => ({ default: 'en', languages: ['en'] }));
  const uiLocale = getLocale(cookieStore, langConfig.default);
  const t = createT(uiLocale);
  const session = await getSession();
  const canCreate = canCreateSetlist(session?.role ?? null);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <h1 className="text-4xl font-bold tracking-tight mb-4">{t('home.title')}</h1>
      <p className="text-neutral-600 dark:text-neutral-400 text-center max-w-md mb-8">
        {t('home.subtitle')}
      </p>
      <div className="flex flex-wrap gap-4 justify-center mb-12">
        <Link
          href="/songs"
          className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
        >
          {t('home.browseSongs')}
        </Link>
        {canCreate && (
          <Link
            href="/setlists/new"
            className="px-6 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg font-medium text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {t('home.newSetlist')}
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl pb-12">
        {FEATURES.map((f) => (
          <FeatureCard
            key={f.key}
            title={t(`home.features.${f.key}`)}
            description={t(`home.features.${f.key}Desc`)}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={f.icon} />
              </svg>
            }
          />
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="p-6 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-950 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
      <div className="text-blue-600 dark:text-blue-400 mb-3">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-neutral-600 dark:text-neutral-400 text-sm">{description}</p>
    </div>
  );
}
