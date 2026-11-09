import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canViewSetlistStats } from "@/lib/auth";
import { collectSetlistUsage, type SetlistStatsPeriod } from "@/lib/setlist-stats";
import { T } from "@/components/Translate";

export const metadata: Metadata = { title: "Setlist statistics" };

const PERIODS: Array<{ key: SetlistStatsPeriod; labelKey: string }> = [
  { key: "month", labelKey: "stats.lastMonth" },
  { key: "year", labelKey: "stats.lastYear" },
  { key: "all", labelKey: "stats.allTime" },
];

function periodFromParam(value: string | undefined): SetlistStatsPeriod {
  return value === "year" || value === "all" ? value : "month";
}

function periodHref(period: SetlistStatsPeriod, lang?: string): string {
  const params = new URLSearchParams({ range: period });
  if (lang) params.set("lang", lang);
  return `/setlists/stats?${params.toString()}`;
}

export default async function SetlistStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; lang?: string; setlist?: string; setlistId?: string }>;
}) {
  const session = await getSession();
  const role = session?.role ?? null;
  if (!canViewSetlistStats(role)) redirect("/login");

  const { range, lang, setlist, setlistId } = await searchParams;
  const period = periodFromParam(range);
  const result = await collectSetlistUsage({
    role,
    userId: session?.userId,
    period,
    setlistId: setlistId || setlist,
  });
  const rows = lang ? result.rows.filter((row) => row.languages.includes(lang)) : result.rows;

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/setlists"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
      >
        &larr; <T k="stats.back" />
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold"><T k="stats.title" /></h1>
        <p className="mt-1 text-sm text-neutral-500"><T k="stats.subtitle" /></p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PERIODS.map((option) => {
          const active = option.key === period;
          return (
            <Link
              key={option.key}
              href={periodHref(option.key, lang)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              }`}
            >
              <T k={option.labelKey} />
            </Link>
          );
        })}
        {lang && (
          <Link
            href={periodHref(period)}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <T k="stats.clearLanguage" />: {lang}
          </Link>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs uppercase tracking-wide text-neutral-500"><T k="stats.events" /></div>
          <div className="mt-1 text-2xl font-semibold">{result.totalEvents}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs uppercase tracking-wide text-neutral-500"><T k="stats.songs" /></div>
          <div className="mt-1 text-2xl font-semibold">{rows.length}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs uppercase tracking-wide text-neutral-500"><T k="stats.undated" /></div>
          <div className="mt-1 text-2xl font-semibold">{result.undatedSetlists}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-neutral-500"><T k="stats.noResults" /></p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 font-medium"><T k="stats.song" /></th>
                <th className="px-4 py-3 font-medium"><T k="stats.uses" /></th>
                <th className="px-4 py-3 font-medium"><T k="stats.setlists" /></th>
                <th className="px-4 py-3 font-medium"><T k="stats.lastUsed" /></th>
                <th className="px-4 py-3 font-medium"><T k="stats.languages" /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.songId} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-3">
                    <Link href={`/songs/${encodeURIComponent(row.songId)}`} className="text-blue-600 hover:underline dark:text-blue-400">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{row.count}</td>
                  <td className="px-4 py-3">{row.setlistCount}</td>
                  <td className="px-4 py-3">{row.lastUsed}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {row.languages.map((code) => (
                      <Link
                        key={code}
                        href={periodHref(period, code)}
                        className="mr-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                      >
                        {code}
                      </Link>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
