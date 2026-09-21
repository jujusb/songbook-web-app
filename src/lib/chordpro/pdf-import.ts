import { txtToChordPro } from "./txt-import";

interface TextItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

interface LineGroup {
  y: number;
  items: TextItem[];
}

interface ColumnRegion {
  xMin: number;
  xMax: number;
}

function groupIntoLines(items: TextItem[], tolerance: number): LineGroup[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    const ydiff = b.y - a.y;
    if (Math.abs(ydiff) > tolerance) return ydiff;
    return a.x - b.x;
  });

  const lines: LineGroup[] = [];
  let current: TextItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (Math.abs(curr.y - prev.y) > tolerance) {
      lines.push({ y: prev.y, items: [...current] });
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  if (current.length > 0) {
    lines.push({ y: current[0].y, items: current });
  }

  return lines;
}

const CHORD_PATTERN = /^[A-Ga-g][b#]?(?:m|min|maj|dim|aug|sus[24]?|add\d{1,2}|M?\d{1,2}|\/[A-Ga-g][b#]?)*$/;

function isChordToken(token: string): boolean {
  return CHORD_PATTERN.test(token.trim());
}

function classifyLine(group: LineGroup): "chords" | "lyrics" | "section" | "other" {
  const text = group.items.map((i) => i.text).join("").trim();
  if (!text) return "other";

  if (/^(?:\[?\s*|--?\s*)(verse|chorus|bridge|pre[- ]?chorus|intro|outro|interlude|tag|coda|instrumental)/i.test(text)) {
    return "section";
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => isChordToken(t))) {
    return "chords";
  }

  return "lyrics";
}

function buildChordPro(
  lineGroups: LineGroup[],
  title: string | null,
  key: string | null
): string {
  const output: string[] = [];

  if (title) output.push(`{title: ${title}}`);
  if (key) output.push(`{key: ${key}}`);
  if (title || key) output.push("");

  let sectionOpen = false;
  let currentSection: string | null = null;

  function closeSection() {
    if (sectionOpen) {
      output.push(`{end_of_${currentSection!}}`);
      output.push("");
      sectionOpen = false;
      currentSection = null;
    }
  }

  function sectionDirective(name: string): string {
    const lower = name.toLowerCase();
    if (lower === "verse" || lower === "chorus" || lower === "bridge") return lower;
    return lower;
  }

  let i = 0;
  while (i < lineGroups.length) {
    const group = lineGroups[i];
    const text = group.items.map((item) => item.text).join("");
    const trimmed = text.trim();

    if (!trimmed) {
      closeSection();
      output.push("");
      i++;
      continue;
    }

    const classification = classifyLine(group);

    if (classification === "section") {
      closeSection();
      const sectionMatch = trimmed.match(
        /^(?:\[?\s*|--?\s*)(verse|chorus|bridge|pre[- ]?chorus|intro|outro|interlude|tag|coda|instrumental)(?:\s*(\d+))?\s*(?:\]?\s*|--?\s*)[:.\-]*\s*$/i
      );
      if (sectionMatch) {
        const sectionName = sectionMatch[1].toLowerCase();
        const sectionNum = sectionMatch[2] || "";
        currentSection = sectionName;
        output.push(`{start_of_${sectionDirective(sectionName)}: ${
          sectionName.charAt(0).toUpperCase() + sectionName.slice(1).toLowerCase() + (sectionNum ? ` ${sectionNum}` : "")
        }}`);
        sectionOpen = true;
      } else {
        output.push(trimmed);
      }
      i++;
      continue;
    }

    if (classification === "chords") {
      const nextGroup = i + 1 < lineGroups.length ? lineGroups[i + 1] : null;
      const nextText = nextGroup ? nextGroup.items.map((item) => item.text).join("").trim() : "";
      const nextClass = nextGroup ? classifyLine(nextGroup) : "other";

      if (!sectionOpen) {
        output.push("{start_of_verse}");
        sectionOpen = true;
        currentSection = "verse";
      }

      if (nextClass === "lyrics" && nextText) {
        const chordPositions: { x: number; chord: string }[] = group.items
          .filter((item) => isChordToken(item.text.trim()))
          .map((item) => ({
            x: item.x,
            chord: item.text.trim(),
          }));

        let lyricLine = nextText;

        if (chordPositions.length > 0) {
          const charWidthGuess = estimateCharWidth(nextGroup!.items);
          const chords = chordPositions.map((cp) => ({
            col: Math.round(cp.x / charWidthGuess),
            chord: cp.chord,
          }));
          chords.sort((a, b) => a.col - b.col);

          const padded = lyricLine.padEnd(
            Math.max(lyricLine.length, chords[chords.length - 1].col + 1)
          );

          let result = "";
          let lastIdx = 0;
          for (const { col, chord } of chords) {
            if (col > lastIdx) {
              result += padded.slice(lastIdx, col);
            }
            result += `[${chord}]`;
            lastIdx = Math.max(lastIdx, col);
          }
          if (lastIdx < padded.length) {
            result += padded.slice(lastIdx);
          }
          output.push(result.trimEnd());
          i += 2;
          continue;
        }

        output.push(lyricLine);
        i += 2;
        continue;
      }

      const chords = trimmed.split(/\s+/);
      output.push(chords.map((c) => `[${c}]`).join(" "));
      i++;
      continue;
    }

    if (classification === "lyrics") {
      if (!sectionOpen) {
        output.push("{start_of_verse}");
        sectionOpen = true;
        currentSection = "verse";
      }
      output.push(trimmed);
      i++;
      continue;
    }

    output.push(trimmed);
    i++;
  }

  closeSection();

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function estimateCharWidth(items: TextItem[]): number {
  const fontSize = items.length > 0 ? items[0].fontSize : 12;
  return fontSize * 0.6;
}

function extractTitle(lines: LineGroup[]): string | null {
  for (const group of lines) {
    const text = group.items.map((i) => i.text).join("").trim();
    if (!text) continue;
    const titleMatch = text.match(/^title\s*[:=]\s*(.+)$/i);
    if (titleMatch) return titleMatch[1].trim();
    const classification = classifyLine(group);
    if (classification !== "lyrics" && classification !== "other") continue;
    if (!/\[[A-Ga-g][b#]?[^[\]]*\]/.test(text)) {
      return text;
    }
    break;
  }
  return null;
}

function extractKey(lines: LineGroup[]): string | null {
  for (const group of lines) {
    const text = group.items.map((i) => i.text).join("").trim();
    const keyMatch = text.match(/^key\s*[:=]\s*([A-Ga-g][b#]?m?)\s*$/i);
    if (keyMatch) return keyMatch[1];
  }
  return null;
}

/**
 * Detect column regions from text item x-coordinates.
 * Finds natural gaps in x-values to split multi-column layouts.
 */
function detectColumns(items: TextItem[]): ColumnRegion[] {
  if (items.length === 0) return [{ xMin: 0, xMax: 1000 }];

  const xs = items.map((i) => i.x).sort((a, b) => b - a);
  const gaps: { idx: number; gap: number }[] = [];
  const gapThreshold = (xs[0] - xs[xs.length - 1]) * 0.08;

  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i - 1] - xs[i];
    if (gap > gapThreshold) {
      gaps.push({ idx: i, gap });
    }
  }

  if (gaps.length === 0) return [{ xMin: Math.min(...xs), xMax: Math.max(...xs) }];

  gaps.sort((a, b) => b.gap - a.gap);

  // Take the largest gaps as column separators (up to 4 columns)
  const separators = gaps.slice(0, Math.min(gaps.length, 3));
  separators.sort((a, b) => b.idx - a.idx);

  const sortedXs = [...xs].sort((a, b) => a - b);
  const regions: ColumnRegion[] = [];
  let start = 0;

  for (const sep of separators) {
    const splitX = (sortedXs[sep.idx - 1] + sortedXs[sep.idx]) / 2;
    regions.push({
      xMin: sortedXs[start],
      xMax: sortedXs[sep.idx - 1],
    });
    start = sep.idx;
  }
  regions.push({
    xMin: sortedXs[start],
    xMax: sortedXs[sortedXs.length - 1],
  });

  return regions;
}

/**
 * Split text items into column groups based on x-coordinate regions.
 */
function splitIntoColumns(items: TextItem[], columns: ColumnRegion[]): TextItem[][] {
  const groups: TextItem[][] = columns.map(() => []);
  for (const item of items) {
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      if (item.x >= col.xMin && item.x <= col.xMax) {
        groups[c].push(item);
        break;
      }
    }
  }
  return groups;
}

export async function extractTextItemsFromPDF(
  file: File
): Promise<{ items: TextItem[]; numPages: number }> {
  const pdfjs = await import("pdfjs-dist");
  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const allItems: TextItem[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    const content = await page.getTextContent();
    for (const item of content.items as any[]) {
      const tx = item.transform;
      allItems.push({
        text: item.str,
        x: tx[4],
        y: pageHeight - tx[5],
        fontSize: item.height || item.fontSize || 12,
      });
    }
  }

  return { items: allItems, numPages: pdf.numPages };
}

export async function pdfToChordPro(file: File): Promise<{
  title: string | null;
  chordpro: string;
  detectedKey: string | null;
}> {
  const { items } = await extractTextItemsFromPDF(file);

  if (items.length === 0) {
    return { title: null, chordpro: "", detectedKey: null };
  }

  // Detect and split columns
  const columns = detectColumns(items);
  const columnGroups = splitIntoColumns(items, columns);

  if (columnGroups.length <= 1) {
    // Single column — existing single-pass processing
    const fontSizes = items.map((i) => i.fontSize);
    const medianFontSize = fontSizes.sort((a, b) => a - b)[Math.floor(fontSizes.length / 2)];
    const lineTolerance = medianFontSize * 1.5;

    const lines = groupIntoLines(items, lineTolerance);
    const title = extractTitle(lines);
    const detectedKey = extractKey(lines);
    const chordpro = buildChordPro(lines, title, detectedKey);

    if (chordpro) {
      return { title, chordpro, detectedKey };
    }

    const allText = items.map((i) => i.text).join("\n");
    return txtToChordPro(allText);
  }

  // Multi-column — process each column independently
  const parts: string[] = [];
  let globalTitle: string | null = null;
  let globalKey: string | null = null;

  for (const group of columnGroups) {
    if (group.length === 0) continue;
    const fontSizes = group.map((i) => i.fontSize);
    const medianFontSize = fontSizes.sort((a, b) => a - b)[Math.floor(fontSizes.length / 2)];
    const lineTolerance = medianFontSize * 1.5;

    const lines = groupIntoLines(group, lineTolerance);
    const title = extractTitle(lines);
    const key = extractKey(lines);
    const chordpro = buildChordPro(lines, title, key);

    if (title && !globalTitle) globalTitle = title;
    if (key && !globalKey) globalKey = key;
    if (chordpro) parts.push(chordpro);
  }

  const result = parts.join("\n\n").trim();
  return {
    title: globalTitle,
    chordpro: result,
    detectedKey: globalKey,
  };
}
