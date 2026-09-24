export interface PartitionInstrument {
  slug: string;
  label: string;
}

/**
 * The client-facing instrument of a partition: the text after the last ` - `
 * (or ` - ` surrounded by spaces) in the PDF filename. Falls back to the
 * instrument folder (or its label) when the filename carries no separator.
 * Pure helpers only — safe to import from client components.
 */
export function partitionInstrumentOf(part: {
  title?: string | null;
  file?: string | null;
  instrument?: string | null;
  instrumentLabel?: string | null;
}): PartitionInstrument {
  const raw = part.title ?? basenameWithoutExtension(part.file ?? '');
  const parsed = parseInstrumentFromTitle(raw);
  if (parsed) {
    return { slug: slugify(parsed) || part.instrument || 'unknown', label: parsed };
  }
  return { slug: part.instrument || 'unknown', label: part.instrumentLabel || part.instrument || 'unknown' };
}

export function basenameWithoutExtension(file: string): string {
  const name = file.split('/').pop() ?? file;
  return name.replace(/\.pdf$/i, '');
}

function parseInstrumentFromTitle(title: string): string | null {
  const cleaned = decodeFileName(title).trim();
  if (!cleaned) return null;

  // Case-insensitive, last occurrence of any of these separators.
  const separators = [' - ', ' – ', ' — ', ' -'];
  let best = -1;
  let bestSep = '';
  for (const sep of separators) {
    const idx = cleaned.toLowerCase().lastIndexOf(sep.toLowerCase());
    if (idx > best) {
      best = idx;
      bestSep = sep;
    }
  }
  if (best <= 0 || best >= cleaned.length - bestSep.length) return null;
  const rest = cleaned.slice(best + bestSep.length).trim();
  return rest || null;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function decodeFileName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}