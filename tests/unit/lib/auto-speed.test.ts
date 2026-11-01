import { describe, it, expect } from 'vitest';
import {
  AUTO_SCROLL_SPEED_OPTIONS,
  formatAutoScrollSpeed,
  isAutoScrollSpeed,
  normalizeAutoScrollSpeed,
  secondsPerScreenForSpeed,
} from '@/lib/auto-speed';

describe('auto-scroll speed helpers', () => {
  it('exposes x0.5, x1, x2 and x3 options', () => {
    expect(AUTO_SCROLL_SPEED_OPTIONS).toEqual([0.5, 1, 2, 3]);
  });

  it('normalizes valid speeds from numbers and strings', () => {
    expect(normalizeAutoScrollSpeed(0.5)).toBe(0.5);
    expect(normalizeAutoScrollSpeed('0.5')).toBe(0.5);
    expect(normalizeAutoScrollSpeed(1)).toBe(1);
    expect(normalizeAutoScrollSpeed('3')).toBe(3);
  });

  it('rejects unsupported speeds', () => {
    expect(normalizeAutoScrollSpeed(1.5)).toBeUndefined();
    expect(normalizeAutoScrollSpeed(4)).toBeUndefined();
    expect(normalizeAutoScrollSpeed('x1')).toBeUndefined();
    expect(normalizeAutoScrollSpeed(null)).toBeUndefined();
    expect(isAutoScrollSpeed(0.5)).toBe(true);
    expect(isAutoScrollSpeed(0)).toBe(false);
  });

  it('maps multipliers to seconds per screen', () => {
    expect(secondsPerScreenForSpeed(0.5)).toBe(120);
    expect(secondsPerScreenForSpeed(1)).toBe(60);
    expect(secondsPerScreenForSpeed(2)).toBe(30);
    expect(secondsPerScreenForSpeed(3)).toBe(20);
  });

  it('formats the multiplier for display', () => {
    expect(formatAutoScrollSpeed(0.5)).toBe('x0.5');
    expect(formatAutoScrollSpeed(1)).toBe('x1');
    expect(formatAutoScrollSpeed(3)).toBe('x3');
  });
});
