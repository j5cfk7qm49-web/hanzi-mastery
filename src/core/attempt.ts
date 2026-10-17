import type { Level } from './config';
export type RecallFailure = 'forgotten-stroke' | 'answer-revealed' | 'guided-practice' | 'incomplete';
export interface StrokeEvent {
  id: number; stroke: number; type: 'rejected' | 'accepted'; at: number; accidental: boolean;
}
export interface Attempt {
  totalStrokes: number; events: StrokeEvent[]; completed: boolean; failure?: RecallFailure;
}
export interface Result {
  level: Level; threshold: number; accuracy: number; rawAccuracy: number; passed: boolean;
  recalled: boolean; completed: boolean; firstAttempts: number; totalStrokes: number;
  mistakes: number; accidents: number; failure?: RecallFailure; suggestedGrade: Grade;
}
export type Grade = 'Again' | 'Hard' | 'Good' | 'Easy';
export function newAttempt(totalStrokes: number): Attempt {
  if (!Number.isInteger(totalStrokes) || totalStrokes < 1 || totalStrokes > 100) throw new Error('Invalid stroke data.');
  return { totalStrokes, events: [], completed: false };
}
export function addStroke(attempt: Attempt, stroke: number, type: StrokeEvent['type'], at = Date.now()): Attempt {
  if (attempt.completed || attempt.failure) return attempt;
  const expected = attempt.events.filter(e => e.type === 'accepted').length;
  // Ignore duplicate, stale or out-of-order engine callbacks.
  if (stroke !== expected || stroke >= attempt.totalStrokes) return attempt;
  const events = [...attempt.events, { id: attempt.events.length, stroke, type, at, accidental: false }];
  return { ...attempt, events, completed: type === 'accepted' && stroke === attempt.totalStrokes - 1 };
}
export function markLastAccidental(attempt: Attempt, limit: number, now = Date.now()): Attempt {
  const last = attempt.events.at(-1);
  if (attempt.completed || attempt.failure || !last || last.type !== 'rejected' || last.accidental ||
      now - last.at > 8000 || now < last.at || attempt.events.filter(e => e.accidental).length >= limit) return attempt;
  return { ...attempt, events: attempt.events.map(e => e.id === last.id ? { ...e, accidental: true } : e) };
}
export function failRecall(attempt: Attempt, failure: RecallFailure): Attempt {
  return attempt.failure ? attempt : { ...attempt, failure };
}
export function gradeAttempt(attempt: Attempt, level: Level, threshold: number): Result {
  let firstAttempts = 0, rawFirst = 0;
  for (let stroke = 0; stroke < attempt.totalStrokes; stroke++) {
    const events = attempt.events.filter(e => e.stroke === stroke);
    if (events.some(e => e.type === 'accepted') && !events.some(e => e.type === 'rejected' && !e.accidental)) firstAttempts++;
    if (events.some(e => e.type === 'accepted') && !events.some(e => e.type === 'rejected')) rawFirst++;
  }
  const accuracy = firstAttempts / attempt.totalStrokes;
  const recalled = attempt.completed && !attempt.failure;
  const passed = recalled && accuracy + 1e-10 >= threshold;
  const accidents = attempt.events.filter(e => e.accidental).length;
  const mistakes = attempt.events.filter(e => e.type === 'rejected').length;
  return { level, threshold, accuracy, rawAccuracy: rawFirst / attempt.totalStrokes, passed, recalled,
    completed: attempt.completed, firstAttempts, totalStrokes: attempt.totalStrokes, mistakes, accidents,
    failure: attempt.failure || (!attempt.completed ? 'incomplete' : undefined),
    // Effort is not inferable from recognizer acceptance. Never automatically suggest Easy.
    suggestedGrade: !passed ? 'Again' : mistakes > accidents || accidents > 0 || accuracy < .9 ? 'Hard' : 'Good' };
}
