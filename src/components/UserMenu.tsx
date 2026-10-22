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

export function UserMenu({ variant = "full" }: { variant?: "full" | "compact" | "buttons" } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

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
    if (variant === "compact") return null;
    return (
      <Link
        href="/login"
        className="text-xs text-neutral-400 hover:text-foreground transition-colors"
      >
        {t('auth.login')}
      </Link>
    );
  }

  const handleLogout = async () => {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    const data = await res.json();
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const nameBadge = (
    <span className="text-xs text-neutral-400">
      {user.displayName || user.username}
      <span className="ml-1 px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[10px]">
        {user.role}
      </span>
    </span>
  );

  if (variant === "compact") return nameBadge;

  // Pill-styled buttons that match the navigation buttons (mobile header).
  const pillClass =
    "shrink-0 whitespace-nowrap rounded-full border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 hover:text-foreground transition-colors";

  const profileLink = (
    <Link
      href="/profile"
      className={`${pillClass} border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300`}
    >
      {t('nav.profile')}
    </Link>
  );
  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      className={`${pillClass} border-red-500 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950/40 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800`}
    >
      {t('auth.logout')}
    </button>
  );

  if (variant === "buttons") {
    return (
      <>
        {profileLink}
        {logoutButton}
      </>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-3">
      {nameBadge}
      {profileLink}
      {logoutButton}
    </div>
  );
}
