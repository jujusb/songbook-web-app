import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getSiteConfig } from "@/lib/content";
import { UserMenu } from "@/components/UserMenu";
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
  try {
    const config = await getSiteConfig();
    enableArtistPages = config.enableArtistPages;
  } catch {
    // config not available yet
  }

  return (
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
                Browse
              </Link>
              <Link
                href="/songs"
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
              >
                Songs
              </Link>
              <Link
                href="/albums"
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
              >
                Albums
              </Link>
              {enableArtistPages && (
                <Link
                  href="/artists"
                  className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
                >
                  Artists
                </Link>
              )}
              <Link
                href="/songs/new"
                className="text-sm px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                + New Song
              </Link>
              <UserMenu />
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
