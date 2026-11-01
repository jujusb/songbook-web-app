export const AUTO_ADVANCE_SPEED_OPTIONS = [3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120];
export const DEFAULT_AUTO_ADVANCE_SECONDS = 10;

export const AUTO_SCROLL_SPEED_OPTIONS = [1, 2, 3];
export const DEFAULT_AUTO_SCROLL_SPEED = 1;
/** Seconds it takes the x1 auto-scroll to move one screen height. */
export const AUTO_SCROLL_BASE_SECONDS_PER_SCREEN = 60;

export function normalizeAutoAdvanceSeconds(value: unknown): number | undefined {
  const seconds = typeof value === "string" ? Number(value) : value;
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return undefined;
  const rounded = Math.round(seconds);
  if (rounded < 1 || rounded > 300) return undefined;
  return rounded;
}

export function normalizeAutoScrollSpeed(value: unknown): 1 | 2 | 3 | undefined {
  const speed = typeof value === "string" ? Number(value) : value;
  if (speed === 1 || speed === 2 || speed === 3) return speed;
  return undefined;
}

export function secondsPerScreenForSpeed(speed: number): number {
  return AUTO_SCROLL_BASE_SECONDS_PER_SCREEN / Math.max(1, speed);
}

export function speedOptionsWith(options: readonly number[], value: number): number[] {
  return options.includes(value)
    ? [...options]
    : [...options, value].sort((a, b) => a - b);
}
