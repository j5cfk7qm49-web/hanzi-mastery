import { describe, expect, it, vi } from 'vitest';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { checkRecall, parsePinyin, parseRecallSchema, pinyinKey, recallFront, type RecallSchema } from '../src/core/recall';
import { ensureRecallCard, readRecallContext, SkillRepository, skillHistoryKey } from '../src/services/recall';
import type { SyncedStore } from '../src/services/persistence';
const schema: RecallSchema = { version: 1, skill: 'pinyin', vocabularyId: 'v', traditional: '仁', pinyin: 'rén', meaning: 'benevolence' };
describe('pinyin and tone recall', () => {
  it('normalizes Unicode marks, numeric tones, umlauts, neutral tones and explicit boundaries', () => {
    expect(pinyinKey(parsePinyin('NǙ lu:4 nv3 de'))).toBe('nü3 lü4 nü3 de5');
    expect(pinyinKey(parsePinyin('xi1\'an1 ni3hao3 ma0'))).toBe('xi1 an1 ni3 hao3 ma5');
    expect(pinyinKey(parsePinyin('lu\u0308\u0300'))).toBe('lü4');
    expect(() => parsePinyin('rén4')).toThrow();
    expect(() => parsePinyin('rénrén')).toThrow();
    expect(() => parsePinyin('人')).toThrow();
  });
  it('requires an explicit syllable for each character and one reading per card', () => {
    expect(() => parseRecallSchema(JSON.stringify({ ...schema, traditional: '人人' }))).toThrow('one pinyin syllable');
    expect(() => parseRecallSchema('null')).toThrow('Invalid');
    expect(() => parseRecallSchema(JSON.stringify({ ...schema, referenceAudio: 'javascript:alert(1)' }))).toThrow();
    expect(() => parseRecallSchema(JSON.stringify({ ...schema, referenceAudio: 'https://user:secret@example.com/audio' }))).toThrow();
  });
  it('requires both spelling and tones, and never silently accepts a missing tone or extra syllable', () => {
    expect(checkRecall(schema, 'ren2')).toMatchObject({ passed: true, accuracy: 1 });
    expect(checkRecall(schema, 'ren')).toMatchObject({ passed: false, spellingCorrect: 1, tonesCorrect: 0 });
    expect(checkRecall(schema, 'hen2')).toMatchObject({ passed: false, spellingCorrect: 0, tonesCorrect: 1 });
    expect(checkRecall(schema, 'ren2 ren2')).toMatchObject({ passed: false, accuracy: 0 });
    expect(checkRecall({ ...schema, skill: 'tones' }, [2])).toMatchObject({ passed: true });
    expect(checkRecall({ ...schema, skill: 'tones' }, [3])).toMatchObject({ passed: false });
  });
  it('keeps the listening target out of its native question', () => {
    const front = recallFront({ ...schema, skill: 'listening' });
    expect(front).not.toContain('仁'); expect(front).not.toContain('rén'); expect(front).not.toContain('benevolence');
  });
});
function memoryStore() {
  const values = new Map<string, unknown>();
  const store: SyncedStore = { getSynced: async <T,>(key: string) => values.get(key) as T | undefined,
    setSynced: vi.fn(async (key: string, value: unknown) => { values.set(key, value); }) };
  return { store, values };
}
it('separates skills/readings and saves concurrent retries once with read-back verification', async () => {
  const { store } = memoryStore(), repository = new SkillRepository(store);
  const record = { id: 'first', at: 10, cardId: 'c', result: checkRecall(schema, 'ren2') };
  await Promise.all([repository.save(schema, record), repository.save(schema, record)]);
  expect(await repository.load(schema)).toMatchObject({ attempts: 1, passed: 1 });
  expect(await repository.load({ ...schema, skill: 'tones' })).toMatchObject({ attempts: 0 });
  expect(skillHistoryKey(schema)).not.toBe(skillHistoryKey({ ...schema, pinyin: 'ren4' }));
  store.getSynced = async () => undefined;
  await expect(repository.save(schema, { ...record, id: 'second' })).rejects.toThrow('not confirmed');
});
it('preserves malformed skill history instead of resetting it', async () => {
  const { store, values } = memoryStore(); values.set(skillHistoryKey(schema), { version: 1, attempts: -1 });
  await expect(new SkillRepository(store).load(schema)).rejects.toThrow('not been reset');
});
it('creates/reuses one forward card per skill, confirms metadata, and resumes a failed draft', async () => {
  const { store } = memoryStore(); let raw = ''; let failOnce = true;
  const rem = { _id: 'card', setPracticeDirection: vi.fn(), setParent: vi.fn(), setText: vi.fn(), setBackText: vi.fn(),
    addPowerup: vi.fn(), hasPowerup: async () => true, getPowerupProperty: async () => raw,
    setPowerupProperty: vi.fn(async (_p: string, _s: string, value: string[]) => {
      if (failOnce) { failOnce = false; throw new Error('host unavailable'); } raw = value[0];
    }) };
  const createRem = vi.fn(async () => rem);
  const plugin = { storage: store, rem: { createRem, findOne: async () => rem } } as unknown as RNPlugin;
  await expect(ensureRecallCard(plugin, schema, 'parent')).rejects.toThrow('host unavailable');
  expect(rem.setPracticeDirection.mock.calls).toEqual([['none']]);
  expect(await ensureRecallCard(plugin, schema, 'parent')).toBe('card');
  expect(await ensureRecallCard(plugin, schema, 'parent')).toBe('card');
  expect(createRem).toHaveBeenCalledTimes(1);
  expect(rem.setPracticeDirection.mock.calls.map(c => c[0])).toEqual(['none', 'none', 'forward']);
  expect(rem.setText).toHaveBeenCalledWith(['Pinyin recall: 仁']);
});
it('binds recall widgets only to the matching forward card and rejects lookback or stale identity', async () => {
  const api = { widget: { getWidgetContext: async () => ({ cardId: 'c', remId: 'r', revealed: false }) },
    rem: { findOne: async () => ({ hasPowerup: async () => true, getPowerupProperty: async () => JSON.stringify(schema) }) },
    queue: { getCurrentCard: async () => ({ _id: 'c', remId: 'r', type: 'forward', repetitionHistory: [{ date: 15 }] }),
      inLookbackMode: async () => false, hasRevealedAnswer: async () => false } };
  expect(await readRecallContext(api as unknown as RNPlugin)).toMatchObject({ cardId: 'c', reviewAt: 15, schema });
  api.widget.getWidgetContext = async () => ({ cardId: 'stale', remId: 'r', revealed: false });
  expect(await readRecallContext(api as unknown as RNPlugin)).toBeNull();
  api.widget.getWidgetContext = async () => ({ cardId: 'c', remId: 'r', revealed: false });
  api.queue.inLookbackMode = async () => true;
  expect(await readRecallContext(api as unknown as RNPlugin)).toBeNull();
});
it('accepts an omitted widget cardId for study cards while rejecting a different Rem, reverse review or lookback', async () => {
  let remId='r',type='forward',lookback=false;
  const api={widget:{getWidgetContext:async()=>({remId,revealed:false})},
    rem:{findOne:async()=>({hasPowerup:async()=>true,getPowerupProperty:async()=>JSON.stringify(schema)})},
    queue:{getCurrentCard:async()=>({_id:'c',remId:'r',type,repetitionHistory:[]}),
      inLookbackMode:async()=>lookback,hasRevealedAnswer:async()=>false}};
  const plugin=api as unknown as RNPlugin;
  expect(await readRecallContext(plugin)).toMatchObject({cardId:'c',schema});
  remId='another-rem';expect(await readRecallContext(plugin)).toBeNull();
  remId='r';type='backward';expect(await readRecallContext(plugin)).toBeNull();
  type='forward';lookback=true;expect(await readRecallContext(plugin)).toBeNull();
});
