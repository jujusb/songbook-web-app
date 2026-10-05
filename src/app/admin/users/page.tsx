import { notFound } from "next/navigation";
import { getSession, canAdmin } from "@/lib/auth";
import { isReadOnlyFor } from "@/lib/readonly";
import { UserManagement } from "@/components/UserManagement";

export default async function AdminUsersPage() {
  if (isReadOnlyFor('user_write')) notFound();
  const session = await getSession();
  if (!canAdmin(session?.role ?? null)) notFound();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <UserManagement />
    </div>
  );
}