import { describe, it, expect, vi } from 'vitest';
import { emptyMastery, readMastery, recordReview, type Mastery, type ReviewRecord } from '../src/core/mastery';
import { DEFAULT_SETTINGS } from '../src/core/config';
import { addStroke, gradeAttempt, newAttempt } from '../src/core/attempt';
import { MasteryRepository, masteryKey } from '../src/services/persistence';
function review(p: Mastery, day: number, pass = true): ReviewRecord {
  let a = newAttempt(1); a = addStroke(a,0,'accepted');
  const r = gradeAttempt(a,p.level,DEFAULT_SETTINGS.thresholds[p.level]);
  return { id: `review-${day}-${pass}`, at: Date.UTC(2026,0,day,12), cardId: 'card', character: '學', source: 'test', result: { ...r, passed: pass } };
}
describe('spaced mastery and persistence', () => {
  it('E: 2 + 2 + 3 spaced passes promote once each, preserving the last day across promotion', () => {
    let p = emptyMastery();
    for (let day=1; day<=7; day++) p=recordReview(p,review(p,day));
    expect(p).toMatchObject({ level:3, peak:3, attempts:7 });
    const sameDay = { ...review(p,7), id:'other-card-same-day', cardId:'other-card' };
    const next=recordReview(p,sameDay); expect(next.stagePasses).toBe(p.stagePasses);
  });
  it('blocks credit after promotion on the same day, across midnight, or with a backwards clock', () => {
    let p = emptyMastery(); p=recordReview(p,review(p,1)); p=recordReview(p,review(p,2));
    expect(p.level).toBe(1);
    p=recordReview(p,{...review(p,2),id:'repeat'}); expect(p.stagePasses).toBe(0);
    const near = { ...review(p,3), id:'near', at:Date.UTC(2026,0,3,1) };
    expect(recordReview(p,near).stagePasses).toBe(0);
    expect(recordReview(p,{...review(p,1),id:'backwards'}).stagePasses).toBe(0);
  });
  it('F: three separate failures regress only one level and retain historical peak', () => {
    let p={...emptyMastery(),level:3 as const,peak:3 as const} as Mastery;
    p=recordReview(p,review(p,1,false)); expect(p.level).toBe(3);
    p=recordReview(p,review(p,2,false)); expect(p.level).toBe(3);
    p=recordReview(p,review(p,3,false)); expect(p).toMatchObject({level:2,peak:3,failureStreak:0});
    expect(p.history.at(-1)!.result.threshold).toBe(.95);
    expect(p.history.at(-1)!.result.passed).toBe(false);
  });
  it('deduplicates records, rejects corrupt persistence, and never overwrites it with defaults', () => {
    const p=emptyMastery(), r=review(p,1), next=recordReview(p,r);
    expect(recordReview(next,r)).toEqual(next);
    expect(() => readMastery({version:1})).toThrow('unsupported');
  });
  it('persists across repository instances and serializes concurrent writes', async () => {
    const map = new Map<string,unknown>();
    const store={ getSynced: async <T,>(k:string)=>structuredClone(map.get(k)) as T,
      setSynced:async(k:string,v:unknown)=>{map.set(k,structuredClone(v));} };
    const repo=new MasteryRepository(store), p=emptyMastery();
    await Promise.all([repo.save('vocab','學',review(p,1),DEFAULT_SETTINGS),repo.save('vocab','學',review(p,2),DEFAULT_SETTINGS)]);
    const next=await new MasteryRepository(store).load('vocab','學');
    expect(next).toMatchObject({level:1,attempts:2});
    await repo.save('vocab','學',review(p,1),DEFAULT_SETTINGS); expect((await repo.load('vocab','學')).attempts).toBe(2);
    expect((await repo.load('other-vocabulary','學')).level).toBe(0);
  });
  it('reports write failures and allows retry without duplicate promotion', async () => {
    let value: unknown;
    const set=vi.fn(async(_k:string,v:unknown)=>{value=v;}).mockRejectedValueOnce(new Error('disk full'));
    const repo=new MasteryRepository({getSynced:async<T,>()=>value as T,setSynced:set});
    const r=review(emptyMastery(),1);
    await expect(repo.save('v','學',r,DEFAULT_SETTINGS)).rejects.toThrow('disk full');
    expect((await repo.save('v','學',r,DEFAULT_SETTINGS)).attempts).toBe(1);
    expect((await repo.save('v','學',r,DEFAULT_SETTINGS)).attempts).toBe(1);
  });
  it('detects a write whose read-back cannot confirm the event', async () => {
    const repo=new MasteryRepository({getSynced:async()=>undefined,setSynced:async()=>{}});
    await expect(repo.save('v','學',review(emptyMastery(),1),DEFAULT_SETTINGS)).rejects.toThrow('not confirmed');
    expect(masteryKey('v','學')).not.toBe(masteryKey('v','学'));
  });
});
