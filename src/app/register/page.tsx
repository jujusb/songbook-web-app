import { RegisterForm } from "@/components/RegisterForm";
import { getSession } from "@/lib/auth";
import { isReadOnlyFor } from "@/lib/readonly";
import { notFound, redirect } from "next/navigation";

export default async function RegisterPage() {
  if (isReadOnlyFor('register')) notFound();
  const session = await getSession();
  if (session) redirect("/setlists/new");

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <RegisterForm />
    </div>
  );
}