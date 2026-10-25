'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';

function ExternalIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function OpenInNewTabButton({
  href,
  variant = 'label',
  className = '',
}: {
  href: string;
  variant?: 'label' | 'icon';
  className?: string;
}) {
  const { t } = useTranslation();
  const label = t('common.openInNewTab');
  const base =
    'inline-flex items-center gap-1 rounded text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={variant === 'icon' ? label : undefined}
      data-testid="open-in-new-tab"
      className={`${base} ${variant === 'icon' ? 'p-1' : 'underline'} ${className}`}
    >
      <ExternalIcon />
      {variant === 'label' && <span>{label}</span>}
    </a>
  );
}

/**
 * Wraps an iframe and always renders an "open in new tab" fallback outside of it.
 * - `label` (default): button row below the frame.
 * - `icon`: compact icon overlaid in the top-right corner of the frame.
 */
export function EmbedFrame({
  href,
  variant = 'label',
  className = '',
  children,
}: {
  href: string;
  variant?: 'label' | 'icon';
  className?: string;
  children: ReactNode;
}) {
  if (variant === 'icon') {
    return (
      <div className={`relative ${className}`}>
        {children}
        <OpenInNewTabButton
          href={href}
          variant="icon"
          className="absolute top-1 right-1 bg-white/80 dark:bg-neutral-900/80"
        />
      </div>
    );
  }
  return (
    <div className={className}>
      {children}
      <div className="mt-1 flex justify-end">
        <OpenInNewTabButton href={href} />
      </div>
    </div>
  );
}
