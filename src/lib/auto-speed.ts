export const AUTO_ADVANCE_SPEED_OPTIONS = [3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120];
export const DEFAULT_AUTO_ADVANCE_SECONDS = 10;

export const AUTO_SCROLL_SPEED_OPTIONS = [0.5, 1, 2, 3] as const;
export const DEFAULT_AUTO_SCROLL_SPEED = 1;
/** Seconds it takes the x1 auto-scroll to move one screen height. */
export const AUTO_SCROLL_BASE_SECONDS_PER_SCREEN = 60;

export type AutoScrollSpeed = (typeof AUTO_SCROLL_SPEED_OPTIONS)[number];

export function normalizeAutoAdvanceSeconds(value: unknown): number | undefined {
  const seconds = typeof value === "string" ? Number(value) : value;
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return undefined;
  const rounded = Math.round(seconds);
  if (rounded < 1 || rounded > 300) return undefined;
  return rounded;
}

export function isAutoScrollSpeed(value: unknown): value is AutoScrollSpeed {
  return (
    typeof value === "number" &&
    (AUTO_SCROLL_SPEED_OPTIONS as readonly number[]).includes(value)
  );
}

export function normalizeAutoScrollSpeed(value: unknown): AutoScrollSpeed | undefined {
  const speed = typeof value === "string" ? Number(value) : value;
  return isAutoScrollSpeed(speed) ? speed : undefined;
}

export function secondsPerScreenForSpeed(speed: number): number {
  return AUTO_SCROLL_BASE_SECONDS_PER_SCREEN / Math.max(0.5, speed);
}

export function formatAutoScrollSpeed(speed: number): string {
  return `x${speed}`;
}

export function speedOptionsWith(options: readonly number[], value: number): number[] {
  return options.includes(value)
    ? [...options]
    : [...options, value].sort((a, b) => a - b);
}
