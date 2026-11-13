import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, canViewSetlistStats } from "@/lib/auth";
import { getSetlist } from "@/lib/content";
import { collectSetlistUsage, type SetlistStatsPeriod } from "@/lib/setlist-stats";
import { T } from "@/components/Translate";
import { cookies } from "next/headers";
import { getLocale, createT } from "@/lib/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ setlistId: string }> }): Promise<Metadata> {
  const { setlistId } = await params;
  const t = createT(getLocale(await cookies()));
  try {
    const setlist = await getSetlist(setlistId);
    return { title: t("setlistApp.detailStatsTitle", { title: setlist.title }) };
  } catch {
    return { title: t("setlistApp.statsTitle") };
  }
}

const PERIODS: Array<{ key: SetlistStatsPeriod; labelKey: string }> = [
  { key: "month", labelKey: "stats.lastMonth" },
  { key: "year", labelKey: "stats.lastYear" },
  { key: "all", labelKey: "stats.allTime" },
];

function periodFromParam(value: string | undefined): SetlistStatsPeriod {
  return value === "year" || value === "all" ? value : "month";
}

export default async function SetlistDetailStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getSession();
  const role = session?.role ?? null;
  if (!canViewSetlistStats(role)) redirect("/login");

  const { setlistId } = await params;
  const { range } = await searchParams;

  let setlist;
  try {
    setlist = await getSetlist(setlistId);
  } catch {
    notFound();
  }

  // Saved references count toward their original setlist's history.
  const sourceId = setlist.sharedFrom?.setlistId ?? setlist.id;
  let source = setlist;
  if (sourceId !== setlist.id) {
    try {
      source = await getSetlist(sourceId);
    } catch {
      notFound();
    }
  }

  const isPrivileged = role === "admin" || role === "reviewer";
  const isOwner = !!session?.userId && source.ownerId === session.userId;
  if (!isPrivileged && !isOwner) notFound();

  const period = periodFromParam(range);
  const result = await collectSetlistUsage({
    role,
    userId: session?.userId,
    period,
    setlistId: sourceId,
  });

  const periodHref = (key: SetlistStatsPeriod) =>
    `/setlists/${encodeURIComponent(setlistId)}/stats?range=${key}`;

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={`/setlists/${encodeURIComponent(setlistId)}`}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
      >
        &larr; {setlist.title}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold"><T k="stats.title" /></h1>
        <p className="mt-1 text-sm text-neutral-500">{setlist.title}</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PERIODS.map((option) => {
          const active = option.key === period;
          return (
            <Link
              key={option.key}
              href={periodHref(option.key)}
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
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs uppercase tracking-wide text-neutral-500"><T k="stats.events" /></div>
          <div className="mt-1 text-2xl font-semibold">{result.totalEvents}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs uppercase tracking-wide text-neutral-500"><T k="stats.songs" /></div>
          <div className="mt-1 text-2xl font-semibold">{result.totalSongs}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs uppercase tracking-wide text-neutral-500"><T k="stats.undated" /></div>
          <div className="mt-1 text-2xl font-semibold">{result.undatedSetlists}</div>
        </div>
      </div>

      {result.rows.length === 0 ? (
        <p className="text-neutral-500"><T k="stats.noResults" /></p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 font-medium"><T k="stats.song" /></th>
                <th className="px-4 py-3 font-medium"><T k="stats.uses" /></th>
                <th className="px-4 py-3 font-medium"><T k="stats.lastUsed" /></th>
                <th className="px-4 py-3 font-medium"><T k="stats.languages" /></th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.songId} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-3">
                    <Link href={`/songs/${encodeURIComponent(row.songId)}`} className="text-blue-600 hover:underline dark:text-blue-400">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{row.count}</td>
                  <td className="px-4 py-3">{row.lastUsed}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {row.languages.map((code) => (
                      <span
                        key={code}
                        className="mr-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800"
                      >
                        {code}
                      </span>
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
