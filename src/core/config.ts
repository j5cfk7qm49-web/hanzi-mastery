export const LEVEL_NAMES = ['Beginner', 'Developing', 'Proficient', 'Mastered'] as const;
export type Level = 0 | 1 | 2 | 3;
export interface Settings {
  script: 'traditional' | 'simplified';
  thresholds: [number, number, number, number];
  promotionReviews: [number, number, number];
  minSpacingHours: number;
  regressionFailures: number;
  leniency: number;
  canvasSize: number;
  accidentLimit: number;
  animationSpeed: number;
  geometryFeedback: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  script: 'traditional', thresholds: [.6, .75, .9, .95], promotionReviews: [2, 2, 3],
  minSpacingHours: 20, regressionFailures: 3, leniency: 1, canvasSize: 320,
  accidentLimit: 1, animationSpeed: 1, geometryFeedback: false,
};
export function parseSettings(input: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(input as Partial<Settings> || {}) };
  const range = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;
  if (!['traditional', 'simplified'].includes(s.script) ||
      !Array.isArray(s.thresholds) || s.thresholds.length !== 4 ||
      !s.thresholds.every((n, i, a) => range(n, .1, 1) && (!i || n >= a[i-1])) ||
      !Array.isArray(s.promotionReviews) || s.promotionReviews.length !== 3 ||
      !s.promotionReviews.every(n => Number.isInteger(n) && range(n, 1, 30)) ||
      !range(s.minSpacingHours, 20, 720) || !Number.isInteger(s.regressionFailures) || !range(s.regressionFailures, 2, 20) ||
      !range(s.leniency, .5, 2) || !range(s.canvasSize, 200, 600) ||
      !Number.isInteger(s.accidentLimit) || !range(s.accidentLimit, 0, 3) ||
      !range(s.animationSpeed, .2, 5) || typeof s.geometryFeedback !== 'boolean') {
    throw new Error('Invalid settings. Check threshold order, ranges and spacing (minimum 20 hours).');
  }
  return { ...s, thresholds: [...s.thresholds], promotionReviews: [...s.promotionReviews] };
}
