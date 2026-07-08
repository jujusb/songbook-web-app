import Link from "next/link";

interface Reference {
  type: string;
  label: string;
  target: string;
  line?: number;
  verse?: string;
  chorus?: string;
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
        <ul className="space-y-2 mb-4">
          {general.map((ref, i) => (
            <li key={`g-${i}`}>
              <ReferenceLink reference={ref} />
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
              <ul className="space-y-1 pl-2 border-l-2 border-neutral-200 dark:border-neutral-800">
                {refs.map((ref, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-amber-500 text-xs mt-0.5">*</span>
                    <ReferenceLink reference={ref} />
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
