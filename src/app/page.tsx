import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <h1 className="text-4xl font-bold tracking-tight mb-4">Songbook</h1>
      <p className="text-neutral-600 dark:text-neutral-400 text-center max-w-md mb-8">
        A collaborative songbook with chord sheets, translations, and
        presentation tools.
      </p>
      <div className="flex gap-4">
        <Link
          href="/songs"
          className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Browse Songs
        </Link>
      </div>
    </div>
  );
}
