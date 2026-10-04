import { getSession, canAdmin } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { isReadOnly } from "@/lib/readonly";
import { PartitionScanClient } from "@/components/PartitionScanClient";

export default async function AdminPartitionsPage() {
  if (isReadOnly()) notFound();
  const session = await getSession();
  if (!canAdmin(session?.role ?? null)) redirect("/login");

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-2">Scan Partitions</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Scan the partitions folder for PDF sheet music, match each file to a
        song by title, and save the matches into the song metadata. Set{" "}
        <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">
          PARTITIONS_DIR
        </code>{" "}
        env var to point at the folder (defaults to{" "}
        <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">
          /app/partitions
        </code>
        ).
      </p>
      <PartitionScanClient />
    </div>
  );
}