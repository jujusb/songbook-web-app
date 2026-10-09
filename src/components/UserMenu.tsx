"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

interface UserInfo {
  id: string;
  username: string;
  role: string;
  displayName?: string;
}

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  // The header lives in the root layout, so it is not remounted on client-side
  // navigations. Re-fetch on every route change so login/logout is reflected
  // immediately instead of staying stale until a full reload.
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [pathname]);

  if (!loaded) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
      >
        {t('auth.login')}
      </Link>
    );
  }

  const handleLogout = async () => {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    const data = await res.json();
    if (data.redirectUrl) {
      // OIDC provider logout — redirect to the provider's logout endpoint
      window.location.href = data.redirectUrl;
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-400">
        {user.displayName || user.username}
        <span className="ml-1 px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[10px]">
          {user.role}
        </span>
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="text-xs text-neutral-400 hover:text-red-500 transition-colors"
      >
        {t('auth.logout')}
      </button>
    </div>
  );
}
