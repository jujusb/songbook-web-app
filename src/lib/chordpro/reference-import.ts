export interface ParsedReference {
  type: string;
  label: string;
  target: string;
  line?: number;
  verse?: string;
  chorus?: string;
  text?: string;
  highlight?: string;
  locations?: { line?: number; verse?: string; chorus?: string }[];
}

function parsePositions(raw: string): { line?: number; verse?: string; chorus?: string }[] {
  const positions: { line?: number; verse?: string; chorus?: string }[] = [];
  const parts = raw.split(",").map((p) => p.trim());
  for (const part of parts) {
    const verseMatch = part.match(/^verse\s*[:=]\s*(.+)$/i);
    const chorusMatch = part.match(/^chorus\s*[:=]\s*(.+)$/i);
    const lineMatch = part.match(/^line\s*[:=]\s*(\d+)$/i);
    if (verseMatch) {
      const existing = positions.find((p) => p.verse === verseMatch[1].trim());
      if (!existing) positions.push({ verse: verseMatch[1].trim() });
    } else if (chorusMatch) {
      const existing = positions.find((p) => p.chorus === chorusMatch[1].trim());
      if (!existing) positions.push({ chorus: chorusMatch[1].trim() });
    } else if (lineMatch) {
      positions.push({ line: parseInt(lineMatch[1], 10) });
    }
  }
  return positions;
}

export function parseReferenceLine(line: string): ParsedReference | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;

  const parts = trimmed.split("|").map((p) => p.trim());
  if (parts.length < 2) return null;

  const type = parts[0].toLowerCase();
  if (!["bible", "song", "link", "text", "audio", "video", "image"].includes(type))
    return null;

  const label = parts[1];
  const target = parts[2] || "";
  const positionRaw = parts[3] || "";
  const text = parts[4] || undefined;
  const highlight = parts[5] || undefined;

  const locations = positionRaw ? parsePositions(positionRaw) : [];

  const ref: ParsedReference = { type, label, target };
  if (text) ref.text = text;
  if (highlight) ref.highlight = highlight;

  if (locations.length === 1) {
    const loc = locations[0];
    if (loc.line !== undefined) ref.line = loc.line;
    if (loc.verse !== undefined) ref.verse = loc.verse;
    if (loc.chorus !== undefined) ref.chorus = loc.chorus;
  } else if (locations.length > 1) {
    ref.locations = locations;
  }

  return ref;
}

export function parseReferences(text: string): ParsedReference[] {
  return text
    .split("\n")
    .map(parseReferenceLine)
    .filter((r): r is ParsedReference => r !== null);
}
