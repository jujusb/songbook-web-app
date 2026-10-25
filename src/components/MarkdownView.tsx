import ReactMarkdown, { type Components } from 'react-markdown';

/**
 * Safe Markdown renderer for user-authored text (setlist notes).
 *
 * react-markdown never emits raw HTML (no rehype-raw) and its default URL
 * transform strips unsafe schemes such as javascript:. Images are dropped so
 * shared setlists can't be used for tracking pixels.
 */
const components: Components = {
  h1: ({ children }) => <h3 className="text-xl font-bold mt-3 mb-2">{children}</h3>,
  h2: ({ children }) => <h4 className="text-lg font-bold mt-3 mb-2">{children}</h4>,
  h3: ({ children }) => <h5 className="font-bold mt-2 mb-1">{children}</h5>,
  p: ({ children }) => <p className="my-2">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-neutral-300 dark:border-neutral-600 pl-3 my-2 text-neutral-600 dark:text-neutral-400">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 text-sm">{children}</code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 dark:text-blue-400 underline print:text-black"
    >
      {children}
    </a>
  ),
};

export function MarkdownView({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`markdown-note break-words whitespace-pre-line ${className}`}>
      <ReactMarkdown components={components} disallowedElements={['img']} unwrapDisallowed>
        {text}
      </ReactMarkdown>
    </div>
  );
}
