"use client";

import { useRouter, usePathname } from "next/navigation";

export function LanguageSwitcher({
  songId,
  languages,
  currentLang,
  linkFor,
}: {
  songId: string;
  languages: string[];
  currentLang: string;
  linkFor?: (lang: string) => string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() =>
            router.push(linkFor ? linkFor(lang) : `${pathname}?lang=${lang}`)
          }
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            lang === currentLang
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-neutral-500 hover:text-foreground hover:border-neutral-300"
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
