import { DEFAULT_SETTINGS, type Level, type Settings } from './config';
import type { Result, Attempt } from './attempt';
export interface ReviewRecord {
  id: string; at: number; cardId: string; character: string; result: Result; source: 'test';
  attempt?: Attempt;
}
export interface Mastery {
  version: 2; level: Level; peak: Level; stagePasses: number; failureStreak: number;
  lastQualifiedAt: number | null; lastQualifiedDay: string | null;
  history: ReviewRecord[]; attempts: number;
}
export const emptyMastery = (): Mastery => ({ version: 2, level: 0, peak: 0, stagePasses: 0,
  failureStreak: 0, lastQualifiedAt: null, lastQualifiedDay: null, history: [], attempts: 0 });
export function readMastery(value: unknown): Mastery {
  if (value === undefined || value === null) return emptyMastery();
  const p = value as Mastery;
  const integer = (n: number) => Number.isInteger(n) && n >= 0;
  if (p.version !== 2 || !integer(p.level) || p.level > 3 || !integer(p.peak) || p.peak > 3 || p.peak < p.level ||
      !integer(p.stagePasses) || !integer(p.failureStreak) || !integer(p.attempts) || !Array.isArray(p.history) ||
      !(p.lastQualifiedAt === null || Number.isFinite(p.lastQualifiedAt)) ||
      !(p.lastQualifiedDay === null || /^\d{4}-\d\d-\d\d$/.test(p.lastQualifiedDay)) ||
      !p.history.every(r => typeof r.id === 'string' && Number.isFinite(r.at) && r.result && typeof r.result.passed === 'boolean')) {
    throw new Error('Stored mastery is invalid or from an unsupported version. Export it before repairing; it has not been reset.');
  }
  return structuredClone(p);
}
export function recordReview(progress: Mastery, review: ReviewRecord, settings: Settings = DEFAULT_SETTINGS): Mastery {
  if (progress.history.some(r => r.id === review.id)) return progress;
  if (!Number.isFinite(review.at) || review.source !== 'test') throw new Error('Only timestamped tests can change mastery.');
  const next = structuredClone(progress);
  next.attempts++;
  next.history = [...next.history, structuredClone(review)].slice(-200);
  const day = new Date(review.at).toISOString().slice(0, 10);
  const spaced = progress.lastQualifiedAt === null || review.at - progress.lastQualifiedAt >= settings.minSpacingHours * 3600000;
  if (!spaced || progress.lastQualifiedDay === day) return next;
  next.lastQualifiedAt = review.at; next.lastQualifiedDay = day;
  // A stale level snapshot is historical evidence, not permission to promote a different level.
  if (review.result.level !== progress.level) return next;
  if (review.result.passed) {
    next.failureStreak = 0; next.stagePasses++;
    if (next.level < 3 && next.stagePasses >= settings.promotionReviews[next.level as 0 | 1 | 2]) {
      next.level = (next.level + 1) as Level; next.peak = Math.max(next.peak, next.level) as Level;
      next.stagePasses = 0;
    }
  } else {
    next.failureStreak++;
    if (next.failureStreak >= settings.regressionFailures && next.level > 0) {
      next.level = (next.level - 1) as Level; next.failureStreak = 0; next.stagePasses = 0;
    }
  }
  return next;
}
