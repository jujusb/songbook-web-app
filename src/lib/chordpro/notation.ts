const LETTERS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLATS: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};
const SOLFEGE = ["Do", "Di", "Re", "Ri", "Mi", "Fa", "Fi", "Sol", "Si", "La", "Li", "Ti"] as const;

export type ChordNotation = "letters" | "solfege" | "roman" | "nashville";
export type Orientation = "portrait" | "landscape";

function normalizeRoot(root: string): string {
  if (FLATS[root]) return FLATS[root];
  return root;
}

function toIndex(root: string): number | null {
  const n = normalizeRoot(root);
  const idx = (LETTERS as unknown as readonly string[]).indexOf(n);
  return idx >= 0 ? idx : null;
}

/**
 * Convert a chord token to another notation. "letters" returns the chord
 * unchanged. Bass notes (C/E) are converted on both sides of the slash.
 */
export function convertChord(
  chord: string,
  notation: ChordNotation,
  keyRoot?: string | null,
): string {
  if (notation === "letters") return chord;
  if (!chord) return chord;
  const parts = chord.split("/");
  const convertOne = (c: string): string => {
    if (!c) return c;
    const m = c.match(/^([A-Ga-g][#b]?)(.*)$/);
    if (!m) return c;
    let root = m[1];
    root = root[0].toUpperCase() + root.slice(1);
    const rest = m[2];
    const idx = toIndex(root);
    if (idx === null) return c;
    if (notation === "solfege") {
      return SOLFEGE[idx] + rest;
    }
    if (notation === "roman" || notation === "nashville") {
      let keyIdx = toIndex(keyRoot || "C");
      if (keyIdx === null) keyIdx = 0;
      const rel = (idx - keyIdx + 12) % 12;
      if (notation === "nashville") {
        const map = ["1", "#1", "2", "#2", "3", "4", "#4", "5", "#5", "6", "#6", "7"];
        return map[rel] + rest;
      }
      const mapR = ["I", "#I", "II", "#II", "III", "IV", "#IV", "V", "#V", "VI", "#VI", "VII"];
      return mapR[rel] + rest;
    }
    return c;
  };
  if (parts.length === 2) {
    return convertOne(parts[0]) + "/" + convertOne(parts[1]);
  }
  return convertOne(parts[0]);
}
