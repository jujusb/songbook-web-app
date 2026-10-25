import React from 'react';
import { parseMarkdown, type Block, type Inline } from '@/lib/markdown';

/**
 * Safe Markdown renderer for user-authored text (setlist notes).
 *
 * Renders an AST from `@/lib/markdown` as React elements: raw HTML is never
 * interpreted, and links are limited to http(s)/mailto and open in a new tab.
 */
function renderInline(nodes: Inline[]): React.ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'text':
        return <React.Fragment key={i}>{n.value}</React.Fragment>;
      case 'br':
        return <br key={i} />;
      case 'strong':
        return <strong key={i}>{renderInline(n.children)}</strong>;
      case 'em':
        return <em key={i}>{renderInline(n.children)}</em>;
      case 'code':
        return (
          <code key={i} className="rounded bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 text-sm">
            {n.value}
          </code>
        );
      case 'link':
        return (
          <a
            key={i}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline print:text-black"
          >
            {renderInline(n.children)}
          </a>
        );
    }
  });
}

function renderBlocks(blocks: Block[]): React.ReactNode[] {
  return blocks.map((b, i) => {
    switch (b.type) {
      case 'heading': {
        const cls = ['text-xl font-bold mt-3 mb-2', 'text-lg font-bold mt-3 mb-2', 'font-bold mt-2 mb-1'][b.level - 1];
        const Tag = (['h3', 'h4', 'h5'] as const)[b.level - 1];
        return <Tag key={i} className={cls}>{renderInline(b.children)}</Tag>;
      }
      case 'paragraph':
        return <p key={i} className="my-2">{renderInline(b.children)}</p>;
      case 'list': {
        const Tag = b.ordered ? 'ol' : 'ul';
        return (
          <Tag key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} pl-6 my-2 space-y-1`}>
            {b.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
          </Tag>
        );
      }
      case 'blockquote':
        return (
          <blockquote key={i} className="border-l-4 border-neutral-300 dark:border-neutral-600 pl-3 my-2 text-neutral-600 dark:text-neutral-400">
            {renderBlocks(b.children)}
          </blockquote>
        );
      case 'code':
        return (
          <pre key={i} className="my-2 overflow-x-auto rounded bg-neutral-100 dark:bg-neutral-800 p-2 text-sm">
            <code>{b.value}</code>
          </pre>
        );
      case 'hr':
        return <hr key={i} className="my-3 border-neutral-300 dark:border-neutral-700" />;
    }
  });
}

export function MarkdownView({ text, className = '' }: { text: string; className?: string }) {
  return <div className={`markdown-note break-words ${className}`}>{renderBlocks(parseMarkdown(text))}</div>;
}
