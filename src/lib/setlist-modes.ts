export const SETLIST_MODES = ["default", "public", "guitarist", "rehersal"] as const;

export type SetlistMode = (typeof SETLIST_MODES)[number];

/**
 * Resolve legacy/alternate mode names to the four behaviours the renderer
 * understands. Unknown or empty values fall back to the user-preference mode.
 */
export function normalizeSetlistMode(mode: string | null | undefined): SetlistMode {
  switch ((mode ?? "").trim().toLowerCase()) {
    case "public":
    case "concert":
      return "public";
    case "guitarist":
    case "instrumentalist":
      return "guitarist";
    case "rehersal":
    case "rehearsal":
      return "rehersal";
    case "default":
      return "default";
    default:
      return "default";
  }
}
