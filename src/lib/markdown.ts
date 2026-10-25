/**
 * Minimal, dependency-free Markdown parser for setlist notes.
 *
 * It produces an AST (never HTML strings) which `MarkdownView` renders as React
 * elements, so raw HTML in the source is always shown as plain text and can
 * never be injected. Supported: headings (#..###), paragraphs, **bold**,
 * *italic*, `code`, fenced code blocks, [links](http(s)/mailto), bullet and
 * numbered lists, blockquotes, horizontal rules and hard line breaks.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'br' };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'code'; value: string }
  | { type: 'hr' };

/** Only these URL schemes may become links. */
export function isSafeLinkUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:';
  } catch {
    return false;
  }
}

const INLINE_RE =
  /(`+)([^`]+?)\1|\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_|\[([^\]]+)\]\(([^)\s]+)\)/;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let rest = src;
  const pushText = (value: string) => {
    if (!value) return;
    const lines = value.split(/ {2,}\n|\n/);
    // A newline inside a paragraph is a hard break (songbook notes are line oriented).
    lines.forEach((line, i) => {
      if (i > 0) out.push({ type: 'br' });
      if (line) out.push({ type: 'text', value: line });
    });
  };
  while (rest) {
    const m = INLINE_RE.exec(rest);
    if (!m) {
      pushText(rest);
      break;
    }
    pushText(rest.slice(0, m.index));
    if (m[2] !== undefined) out.push({ type: 'code', value: m[2] });
    else if (m[3] !== undefined || m[4] !== undefined) out.push({ type: 'strong', children: parseInline((m[3] ?? m[4])!) });
    else if (m[5] !== undefined || m[6] !== undefined) out.push({ type: 'em', children: parseInline((m[5] ?? m[6])!) });
    else if (isSafeLinkUrl(m[8])) out.push({ type: 'link', href: m[8], children: parseInline(m[7]) });
    else pushText(m[0]); // unsafe scheme: keep as literal text
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  const isBlank = (l: string) => l.trim() === '';
  const startsBlock = (l: string) =>
    /^(#{1,6}\s|>|```|\s*[-*+]\s|\s*\d+[.)]\s|(-{3,}|\*{3,}|_{3,})\s*$)/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }

    if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++; // closing fence
      blocks.push({ type: 'code', value: code.join('\n') });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ type: 'heading', level: Math.min(h[1].length, 3) as 1 | 2 | 3, children: parseInline(h[2].trim()) });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }
    if (line.startsWith('>')) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) quoted.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'blockquote', children: parseMarkdown(quoted.join('\n')) });
      continue;
    }
    const ul = /^\s*[-*+]\s+/;
    const ol = /^\s*\d+[.)]\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const re = ordered ? ol : ul;
      const items: Inline[][] = [];
      while (i < lines.length && re.test(lines[i])) items.push(parseInline(lines[i++].replace(re, '')));
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !isBlank(lines[i]) && (para.length === 0 || !startsBlock(lines[i]))) para.push(lines[i++]);
    blocks.push({ type: 'paragraph', children: parseInline(para.join('\n')) });
  }
  return blocks;
}
