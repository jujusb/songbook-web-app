import Link from "next/link";

interface Reference {
  type: string;
  label: string;
  target: string;
  line?: number;
  verse?: string;
  chorus?: string;
  text?: string;
  highlight?: string;
}

function ReferenceLink({ reference: r }: { reference: Reference }) {
  if (r.type === "song") {
    return (
      <Link
        href={`/songs/${r.target}`}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        {r.label}
      </Link>
    );
  }
  if (r.type === "link") {
    return (
      <a
        href={r.target}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        {r.label}
      </a>
    );
  }
  return (
    <span className="text-sm text-neutral-600 dark:text-neutral-400">
      {r.label}
    </span>
  );
}

/**
 * Renders text with the `highlight` substring wrapped in a <mark>.
 * If highlight is absent or not found, renders the full text plain.
 */
function HighlightedText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight) {
    return <span>{text}</span>;
  }

  const index = text.indexOf(highlight);
  if (index === -1) {
    return <span>{text}</span>;
  }

  const before = text.slice(0, index);
  const after = text.slice(index + highlight.length);

  return (
    <span>
      {before}
      <mark className="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-0.5 rounded-sm">
        {highlight}
      </mark>
      {after}
    </span>
  );
}

function ReferenceText({ reference: r }: { reference: Reference }) {
  if (!r.text) return null;
  return (
    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed italic pl-2 border-l-2 border-neutral-200 dark:border-neutral-700">
      <HighlightedText text={r.text} highlight={r.highlight} />
    </div>
  );
}

function getLocationLabel(r: Reference): string | null {
  if (r.verse) return r.verse;
  if (r.chorus) return r.chorus;
  if (r.line !== undefined) return `Line ${r.line + 1}`;
  return null;
}

function isLocated(r: Reference): boolean {
  return r.line !== undefined || !!r.verse || !!r.chorus;
}

export function ReferencePanel({ references }: { references: Reference[] }) {
  const general = references.filter((r) => !isLocated(r));
  const located = references.filter(isLocated);

  // Group located references by their location label
  const byLocationMap = new Map<string, Reference[]>();
  for (const r of located) {
    const key = getLocationLabel(r) || "Unknown";
    const existing = byLocationMap.get(key) || [];
    existing.push(r);
    byLocationMap.set(key, existing);
  }
  const byLocation = Array.from(byLocationMap.entries());

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
        References
      </h3>

      {/* General references */}
      {general.length > 0 && (
        <ul className="space-y-3 mb-4">
          {general.map((ref, i) => (
            <li key={`g-${i}`}>
              <ReferenceLink reference={ref} />
              <ReferenceText reference={ref} />
            </li>
          ))}
        </ul>
      )}

      {/* Located references grouped by verse/chorus/line */}
      {byLocation.length > 0 && (
        <div className="space-y-3">
          {general.length > 0 && (
            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
                By Section
              </span>
            </div>
          )}
          {byLocation.map(([locationName, refs]) => (
            <div key={locationName}>
              <div className="text-xs font-semibold text-neutral-500 mb-1">
                {locationName}
              </div>
              <ul className="space-y-2 pl-2 border-l-2 border-neutral-200 dark:border-neutral-800">
                {refs.map((ref, i) => (
                  <li key={i}>
                    <div className="flex items-start gap-1">
                      <span className="text-amber-500 text-xs mt-0.5">*</span>
                      <ReferenceLink reference={ref} />
                    </div>
                    <ReferenceText reference={ref} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {references.length === 0 && (
        <p className="text-sm text-neutral-400">No references.</p>
      )}
    </div>
  );
}
