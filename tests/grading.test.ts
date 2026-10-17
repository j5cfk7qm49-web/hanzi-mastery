import { describe, it, expect } from 'vitest';
import { addStroke, failRecall, gradeAttempt, markLastAccidental, newAttempt } from '../src/core/attempt';
import { DEFAULT_SETTINGS, parseSettings, type Level } from '../src/core/config';
function attempt(strokes = 10, mistakes = [2,7]) {
  let a = newAttempt(strokes);
  for (let i = 0; i < strokes; i++) {
    if (mistakes.includes(i)) a = addStroke(a, i, 'rejected');
    a = addStroke(a, i, 'accepted');
  }
  return a;
}
describe('independent recall and first-attempt grading', () => {
  it('A: Beginner passes 8/10 independently recalled strokes', () => {
    const r = gradeAttempt(attempt(), 0, .6);
    expect(r.accuracy).toBe(.8); expect(r.passed).toBe(true); expect(r.suggestedGrade).toBe('Hard');
  });
  it('B: identical Mastered attempt fails at the frozen 95% threshold', () => {
    expect(gradeAttempt(attempt(), 3, .95)).toMatchObject({ passed: false, threshold: .95, recalled: true });
  });
  it.each([0,1,2,3] as Level[])('C: forgotten stroke fails at level %s', level => {
    expect(gradeAttempt(failRecall(attempt(10, []), 'forgotten-stroke'), level, DEFAULT_SETTINGS.thresholds[level]).passed).toBe(false);
  });
  it.each(['answer-revealed', 'guided-practice'] as const)('reveal/practice assistance fails (%s)', failure => {
    expect(gradeAttempt(failRecall(attempt(10,[]), failure), 0, .6).recalled).toBe(false);
  });
  it('D: one promptly declared accidental rejection is auditable and restores eligibility', () => {
    let a = addStroke(newAttempt(3), 0, 'rejected', 1000);
    a = markLastAccidental(a, 1, 2000);
    for (let i=0; i<3; i++) a = addStroke(a, i, 'accepted', 3000+i);
    expect(gradeAttempt(a, 3, .95)).toMatchObject({ accuracy: 1, rawAccuracy: 2/3, accidents: 1, mistakes: 1, passed: true, suggestedGrade: 'Hard' });
    expect(a.events[0]).toMatchObject({ type: 'rejected', accidental: true });
  });
  it('cannot forgive an earlier, completed, expired or excess input; a genuine error remains', () => {
    let a = addStroke(newAttempt(3), 0, 'rejected', 1000);
    expect(markLastAccidental(a,1,9001)).toEqual(a);
    a = addStroke(a,0,'accepted',2000);
    expect(markLastAccidental(a,1,2100)).toEqual(a);
    a = addStroke(a,1,'rejected',2200); a = markLastAccidental(a,1,2300);
    a = addStroke(a,1,'rejected',2400);
    expect(markLastAccidental(a,1,2500)).toEqual(a);
    a = addStroke(a,1,'accepted'); a = addStroke(a,2,'accepted');
    expect(gradeAttempt(a,0,.6).accuracy).toBe(1/3);
  });
  it('does not count rejected strokes as forgetting, but requires completion', () => {
    const a = addStroke(newAttempt(10),0,'rejected');
    expect(a.failure).toBeUndefined(); expect(gradeAttempt(a,0,.6).passed).toBe(false);
  });
  it('normalizes by stroke count and rejects duplicate or out-of-order callbacks', () => {
    expect(gradeAttempt(attempt(3,[0]),0,.6).accuracy).toBe(2/3);
    expect(gradeAttempt(attempt(20,[0,1,2,3]),0,.6).accuracy).toBe(.8);
    let a = newAttempt(3); expect(addStroke(a,1,'accepted')).toEqual(a);
    a = addStroke(a,0,'accepted'); expect(addStroke(a,0,'accepted')).toEqual(a);
  });
  it('does not infer effortless recall or Easy from recognizer acceptance', () => {
    expect(gradeAttempt(attempt(10,[]),0,.6).suggestedGrade).toBe('Good');
  });
  it('validates configurable thresholds, spacing and tolerance', () => {
    expect(parseSettings({ thresholds: [.65,.8,.91,.97] }).thresholds[3]).toBe(.97);
    expect(() => parseSettings({ thresholds:[.9,.7,.9,.95] })).toThrow();
    expect(() => parseSettings({ minSpacingHours:0 })).toThrow();
  });
});
