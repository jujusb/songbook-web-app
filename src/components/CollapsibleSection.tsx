"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  className = "",
  titleClassName = "",
  contentClassName = "",
}: CollapsibleSectionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full px-4 py-3 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${titleClassName}`}
        aria-expanded={open}
      >
        <span className="font-medium text-sm text-neutral-900 dark:text-white">{title}</span>
        <svg
          className={`w-5 h-5 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"} ${contentClassName}`}
      >
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
