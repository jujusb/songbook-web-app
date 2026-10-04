"use client";

import { useState } from "react";
import Link from "next/link";
import { getReferenceText, getHighlight } from "@/lib/content/references";

interface ReferenceLocation {
  line?: number;
  verse?: string;
  chorus?: string;
  highlight?: string;
  highlights?: Record<string, string>;
}

interface Reference {
  type: string;
  label: string;
  target: string;
  line?: number;
  verse?: string;
  chorus?: string;
  text?: string;
  texts?: Record<string, string>;
  highlight?: string;
  highlights?: Record<string, string>;
  locations?: ReferenceLocation[];
}

function getLocationLabel(
  loc: { line?: number; verse?: string; chorus?: string }
): string | null {
  if (loc.verse) return loc.verse;
  if (loc.chorus) return loc.chorus;
  if (loc.line !== undefined) return `Line ${loc.line + 1}`;
  return null;
}

function isLocated(r: Reference): boolean {
  return (
    r.line !== undefined ||
    !!r.verse ||
    !!r.chorus ||
    (!!r.locations && r.locations.length > 0)
  );
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

function ReferenceText({
  reference: r,
  highlight: highlightOverride,
  lang = "en",
}: {
  reference: Reference;
  highlight?: string;
  lang?: string;
}) {
  const text = getReferenceText(r, lang);
  const hl = highlightOverride ?? getHighlight(r, lang);
  if (!text) return null;
  return (
    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed italic pl-2 border-l-2 border-neutral-200 dark:border-neutral-700">
      <HighlightedText text={text} highlight={hl} />
    </div>
  );
}

interface ReferencePanelProps {
  references: Reference[];
  lang?: string;
  variant?: "sidebar" | "collapsible";
  defaultOpen?: boolean;
}

export function ReferencePanel({
  references,
  lang = "en",
  variant = "sidebar",
  defaultOpen = false,
}: ReferencePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  const general = references.filter((r) => !isLocated(r));
  const located = references.filter(isLocated);

  const entries: { label: string; reference: Reference; highlight?: string }[] = [];
  for (const r of located) {
    if (r.locations && r.locations.length > 0) {
      for (const loc of r.locations) {
        const label = getLocationLabel(loc);
        if (label) {
          entries.push({ label, reference: r, highlight: getHighlight(loc, lang) || getHighlight(r, lang) });
        }
      }
    } else {
      const label = getLocationLabel(r);
      if (label) {
        entries.push({ label, reference: r });
      }
    }
  }

  const byLocationMap = new Map<string, { reference: Reference; highlight?: string }[]>();
  for (const { label, reference, highlight } of entries) {
    const existing = byLocationMap.get(label) || [];
    existing.push({ reference, highlight });
    byLocationMap.set(label, existing);
  }
  const byLocation = Array.from(byLocationMap.entries());

  const content = (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
          References
        </h3>
        {variant === "collapsible" && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            aria-expanded={open}
          >
            {open ? "Hide" : "Show"}
          </button>
        )}
      </div>

      {open || variant === "sidebar" ? (
        <>
          {general.length > 0 && (
            <ul className="space-y-3 mb-4">
              {general.map((ref, i) => (
                <li key={`g-${i}`}>
                  <ReferenceLink reference={ref} />
                  <ReferenceText reference={ref} lang={lang} />
                </li>
              ))}
            </ul>
          )}

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
                          <ReferenceLink reference={ref.reference} />
                        </div>
                        <ReferenceText reference={ref.reference} highlight={ref.highlight} lang={lang} />
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
        </>
      ) : null}
    </div>
  );

  if (variant === "collapsible") {
    return (
      <details className="group">
        <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg">
          <span className="font-medium text-sm text-neutral-900 dark:text-white">
            References {references.length > 0 && `(${references.length})`}
          </span>
          <svg
            className={`w-5 h-5 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
          {content}
        </div>
      </details>
    );
  }

  return content;
}
