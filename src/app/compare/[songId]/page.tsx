import { notFound } from "next/navigation";
import { getSong, getSongTranslation, getSongTranslations } from "@/lib/content";
import { ChordSheet } from "@/components/ChordSheet";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ songId: string }>;
  searchParams: Promise<{ langs?: string }>;
}) {
  const { songId } = await params;
  const { langs: langsParam } = await searchParams;

  let meta;
  try {
    meta = await getSong(songId);
  } catch {
    notFound();
  }

  const availableTranslations = await getSongTranslations(songId);
  const requestedLangs = langsParam
    ? langsParam.split(",").filter((l) => availableTranslations.includes(l))
    : availableTranslations;

  if (requestedLangs.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">{meta.title}</h1>
        <p className="text-neutral-500">No translations to compare.</p>
      </div>
    );
  }

  const translations = await Promise.all(
    requestedLangs.map(async (lang) => {
      const { body } = await getSongTranslation(songId, lang);
      return { lang, body };
    })
  );

  return (
    <div className="max-w-full mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{meta.title}</h1>
        <p className="text-sm text-neutral-500">
          Comparing {requestedLangs.length} translations
        </p>
      </div>
      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: `repeat(${translations.length}, minmax(300px, 1fr))`,
        }}
      >
        {translations.map(({ lang, body }) => (
          <div
            key={lang}
            className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              <span className="font-semibold text-sm">{lang.toUpperCase()}</span>
            </div>
            <div className="p-4">
              <ChordSheet initialSource={body} songKey={meta.key ?? null} references={meta.references} idPrefix={lang} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
