"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserInfo {
  id: string;
  username: string;
  role: string;
  displayName?: string;
}

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
      >
        Sign In
      </Link>
    );
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
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
        Logout
      </button>
    </div>
  );
}
