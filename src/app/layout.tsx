import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import { getSiteConfig } from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canEdit } from "@/lib/auth";
import { UserMenu } from "@/components/UserMenu";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { RootClientLayout } from "@/components/RootClientLayout";
import { T } from "@/components/Translate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Songbook",
  description: "A self-hosted songbook with chords, translations, and presentation tools",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let enableArtistPages = false;
  let showEditActions = false;
  const uiLocale = getLocale(await cookies());
  try {
    const config = await getSiteConfig();
    enableArtistPages = config.enableArtistPages;
  } catch {
    // config not available yet
  }
  try {
    const session = await getSession();
    showEditActions = canEdit(session?.role ?? null);
  } catch {}

  return (
    <RootClientLayout initialLocale={uiLocale}>
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-50">
          <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg tracking-tight">
              Songbook
            </Link>
            <div className="flex items-center gap-6">
              <Link
                href="/browse"
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
              >
                <T k="nav.browse" />
              </Link>
              <Link
                href="/songs"
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
              >
                <T k="nav.songs" />
              </Link>
              <Link
                href="/albums"
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
              >
                <T k="nav.albums" />
              </Link>
              <Link
                href="/setlists"
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
              >
                <T k="nav.setlists" />
              </Link>
              {enableArtistPages && (
                <Link
                  href="/artists"
                  className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
                >
                  <T k="nav.artists" />
                </Link>
              )}
              {showEditActions && (
                <Link
                  href="/songs/new"
                  className="text-sm px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity"
                >
                  <T k="nav.newSong" />
                </Link>
              )}
              {showEditActions && (
                <Link
                  href="/import/music"
                  className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
                >
                  <T k="nav.import" />
                </Link>
              )}
              <LocaleSwitcher />
              <UserMenu />
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
    </RootClientLayout>
  );
}
