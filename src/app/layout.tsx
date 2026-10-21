import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import { getSiteConfig, getLanguagesConfig } from "@/lib/content";
import { getLocale } from "@/lib/i18n/server";
import { getSession, canEdit, canAdmin, canCreateSetlist } from "@/lib/auth";
import { isReadOnly } from "@/lib/readonly";
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

const APP_NAME = process.env.SONGBOOK_APP_NAME || "Songbook";
const CONTACT_EMAIL = process.env.SONGBOOK_CONTACT_EMAIL || "";
const GITHUB_URL =  "https://github.com/jujusb/songbook-web-app";

/** Navigation entry: a pill button on phones, a plain link on wide screens. */
const NAV_LINK_CLASS =
  "shrink-0 whitespace-nowrap rounded-full border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800 transition-colors sm:border-0 sm:rounded-none sm:px-0 sm:py-0 sm:text-sm sm:font-normal";

/** Primary navigation action (new song, new setlist). */
const NAV_ACTION_CLASS =
  "shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 transition-opacity sm:rounded-md sm:px-3 sm:py-1.5 sm:text-sm";

/** Secondary navigation action (convert to PDF). */
const NAV_OUTLINE_CLASS =
  "shrink-0 whitespace-nowrap rounded-full border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-foreground transition-colors sm:rounded-md sm:px-3 sm:py-1.5 sm:text-sm";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "A self-hosted songbook with chords, translations, and presentation tools",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let enableArtistPages = false;
  let showEditActions = false;
  let showAdminActions = false;
  let showCreateSetlist = false;
  const cookieStore = await cookies();
  let fallbackLocale = 'en';
  let songLanguages: string[] | undefined;
  try {
    const langConfig = await getLanguagesConfig();
    fallbackLocale = langConfig.default;
    songLanguages = langConfig.languages;
  } catch {
    // languages config not available yet
  }
  const uiLocale = getLocale(cookieStore, fallbackLocale);
  try {
    const config = await getSiteConfig();
    enableArtistPages = config.enableArtistPages;
  } catch {
    // config not available yet
  }
  try {
    const session = await getSession();
    showEditActions = canEdit(session?.role ?? null);
    showAdminActions = canAdmin(session?.role ?? null);
    showCreateSetlist = canCreateSetlist(session?.role ?? null);
  } catch {}

  return (
    <RootClientLayout initialLocale={uiLocale} songLanguages={songLanguages}>
    <html
      lang={uiLocale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-50">
          <nav className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-0 sm:h-14 min-h-14 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
            {/*
              On phones the navigation is a row of buttons above the title; on
              wider screens it sits on the right of the title as before.
            */}
            <div className="order-1 sm:order-2 w-full sm:w-auto sm:flex-1 flex min-w-0 items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible sm:justify-end [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link href="/browse" className={NAV_LINK_CLASS}>
                <T k="nav.browse" />
              </Link>
              <Link href="/songs" className={NAV_LINK_CLASS}>
                <T k="nav.songs" />
              </Link>
              <Link href="/albums" className={NAV_LINK_CLASS}>
                <T k="nav.albums" />
              </Link>
              <Link href="/setlists" className={NAV_LINK_CLASS}>
                <T k="nav.setlists" />
              </Link>
              {enableArtistPages && (
                <Link href="/artists" className={NAV_LINK_CLASS}>
                  <T k="nav.artists" />
                </Link>
              )}
              {showEditActions && (
                <Link href="/songs/new" className={NAV_ACTION_CLASS}>
                  <T k="nav.newSong" />
                </Link>
              )}
              {showAdminActions && (
                <>
                  <Link href="/admin/partitions" className={NAV_LINK_CLASS}>
                    <T k="nav.admin" />
                  </Link>
                  <Link href="/admin/users" className={NAV_LINK_CLASS}>
                    <T k="nav.users" />
                  </Link>
                </>
              )}
              {(showEditActions || showCreateSetlist) && (
                <Link href="/setlists/new" className={NAV_ACTION_CLASS}>
                  <T k="nav.newSetlist" />
                </Link>
              )}
              <Link
                href="/pdf"
                className={NAV_OUTLINE_CLASS}
                title="Open the convert-to-PDF page to export as PDF"
              >
                Convert to PDF
              </Link>
            </div>
            <div className="order-2 sm:order-1 sm:contents flex items-center justify-between gap-3 w-full sm:w-auto min-w-0">
              <Link
                href="/"
                className="order-2 sm:order-1 min-w-0 flex-1 sm:flex-none font-bold text-lg tracking-tight truncate"
              >
                {APP_NAME}
              </Link>
              <div className="order-3 flex shrink-0 items-center gap-2">
                <LocaleSwitcher />
                <UserMenu />
              </div>
            </div>
          </nav>
        </header>
        <main className="flex-1 flex-grow">{children}</main>
        <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 mt-auto">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col items-center gap-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {CONTACT_EMAIL && (
              <p className="flex max-w-full flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                <span><T k="footer.contact" /></span>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="max-w-full break-all text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            )}
            {GITHUB_URL && (
              <p className="max-w-full">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block max-w-full break-words text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <T k="footer.github" />
                </a>
              </p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <label
                htmlFor="footer-locale"
                className="text-xs opacity-80"
              >
                <T k="common.language" />
              </label>
              <LocaleSwitcher id="footer-locale" className="px-2 py-1 text-sm" />
            </div>
          </div>
        </footer>
      </body>
    </html>
    </RootClientLayout>
  );
}
