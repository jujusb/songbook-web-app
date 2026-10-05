import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth";
import { getSiteConfig } from "@/lib/content";
import { isReadOnlyFor } from "@/lib/readonly";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (isReadOnlyFor('login')) notFound();
  const session = await getSession();
  if (session) redirect("/browse");

  const site = await getSiteConfig();
  const oidcEnabled = site.oidc?.enabled ?? false;
  const oidcButtonLabel = site.oidc?.buttonLabel ?? "Sign in with SSO";
  const oidcAutoRedirect = site.oidc?.autoRedirect ?? false;
  const params = await searchParams;

  // If autoRedirect is enabled and there's no error (avoiding redirect loops),
  // send the user directly to the OIDC provider
  if (oidcAutoRedirect && !params.error) {
    redirect("/api/auth/oidc");
  }

  const canRegister = !isReadOnlyFor('user_write');

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-6 text-center">Sign In</h1>
      {params.error && (
        <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {params.error}
        </div>
      )}
      <LoginForm
        oidcEnabled={oidcEnabled}
        oidcButtonLabel={oidcButtonLabel}
      />
      {canRegister && (
        <p className="mt-4 text-center text-sm text-neutral-500">
          Don't have an account?{" "}
          <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
            Create one
          </Link>
        </p>
      )}
    </div>
  );
}
