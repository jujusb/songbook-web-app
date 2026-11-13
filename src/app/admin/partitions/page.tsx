import { getSession, canAdmin } from "@/lib/auth";
import { cookies } from "next/headers";
import { getLocale, createT } from "@/lib/i18n/server";
import { notFound, redirect } from "next/navigation";
import { isReadOnly } from "@/lib/readonly";
import { PartitionScanClient } from "@/components/PartitionScanClient";

export default async function AdminPartitionsPage() {
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canAdmin(session?.role ?? null)) redirect("/login");

  const t = createT(getLocale(await cookies(), 'en-US'));

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-2">{t('partitions.scan')}</h1>
      <p className="text-sm text-neutral-500 mb-6">
        {t('adminApp.partitionsDescA')}{" "}
        <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">
          PARTITIONS_DIR
        </code>{" "}
        {t('adminApp.partitionsDescB')}{" "}
        <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">
          /app/partitions
        </code>
        {t('adminApp.partitionsDescC')}
      </p>
      <PartitionScanClient />
    </div>
  );
}