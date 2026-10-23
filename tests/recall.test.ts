import { describe, expect, it, vi } from 'vitest';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { checkRecall, parsePinyin, parseRecallSchema, pinyinKey, recallFront, spellingKey, type RecallSchema } from '../src/core/recall';
import { buildCharacterChoices } from '../src/core/characterChoices';
import { ensureRecallCard, readRecallContext, SkillRepository, skillHistoryKey, vocabularyCharacterChoices } from '../src/services/recall';
import type { SyncedStore } from '../src/services/persistence';
const schema: RecallSchema = { version: 1, skill: 'pinyin', vocabularyId: 'v', traditional: '仁', pinyin: 'rén', meaning: 'benevolence' };
describe('pinyin and tone recall', () => {
  it('supports both translation directions without a supplied reading and keeps production targets hidden', () => {
    const forward: RecallSchema = { ...schema, skill: 'english-to-chinese', pinyin: '' };
    const reverse: RecallSchema = { ...schema, skill: 'chinese-to-english', pinyin: '' };
    expect(parseRecallSchema(JSON.stringify(forward))).toEqual(forward);
    expect(parseRecallSchema(JSON.stringify(reverse))).toEqual(reverse);
    expect(recallFront(forward)).not.toContain('仁'); expect(recallFront(reverse)).not.toContain('benevolence');
    expect(skillHistoryKey(forward)).not.toBe(skillHistoryKey({ ...forward, meaning: 'kindness' }));
    expect(() => parseRecallSchema(JSON.stringify({ ...forward, meaning: 'benevolence 仁' }))).toThrow('English study meaning');
  });
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

describe('pinyin to character recognition', () => {
  const target = { traditional: '人', pinyin: 'rén' };
  const choiceSchema: RecallSchema = { ...schema, ...target, skill: 'character-choice', choices: [target, { traditional: '書', pinyin: 'shū' }] };
  it('excludes homophones, tone-only differences, repeated forms and different word lengths', () => {
    const choices = buildCharacterChoices(target, [target, { traditional: '仁', pinyin: 'ren2' },
      { traditional: '忍', pinyin: 'rěn' }, { traditional: '書', pinyin: 'shū' },
      { traditional: '書', pinyin: 'shu1' }, { traditional: '中國', pinyin: 'zhōng guó' },
      { traditional: '愛', pinyin: 'ài' }, { traditional: '國', pinyin: 'guó' }]);
    expect(choices.map(c => c.traditional).sort()).toEqual(['人', '國', '愛', '書'].sort());
    expect(new Set(choices.map(c => spellingKey(c.pinyin))).size).toBe(choices.length);
  });
  it('considers every recorded reading of a polyphone, including alternate target readings', () => {
    const entries = [{ traditional: '樂', pinyin: 'lè' }, { traditional: '樂', pinyin: 'yuè' },
      { traditional: '月', pinyin: 'yuè' }, { traditional: '書', pinyin: 'shū' }];
    const left = buildCharacterChoices({ traditional: '樂', pinyin: 'lè' }, entries).map(c => c.traditional);
    const right = buildCharacterChoices({ traditional: '月', pinyin: 'yuè' }, entries).map(c => c.traditional);
    expect(left).toHaveLength(4); expect(left).not.toContain('月'); expect(left).toContain('書');
    expect(right).toHaveLength(4); expect(right).not.toContain('樂'); expect(right).toContain('書');
  });
  it('uses bundled dictionary readings to exclude an unrecorded polyphonic homophone', () => {
    const choices = buildCharacterChoices({ traditional: '型', pinyin: 'xíng' }, [
      { traditional: '行', pinyin: 'háng' }, { traditional: '書', pinyin: 'shū' },
    ]);
    expect(choices).toHaveLength(4); expect(choices.map(c => c.traditional)).not.toContain('行');
    const reverse = buildCharacterChoices({ traditional: '行', pinyin: 'háng' }, [
      { traditional: '型', pinyin: 'xíng' }, { traditional: '書', pinyin: 'shū' },
    ]);
    expect(reverse).toHaveLength(4); expect(reverse.map(c => c.traditional)).not.toContain('型');
  });
  it('conservatively excludes overlapping polyphonic word readings without generating all combinations', () => {
    const choices = buildCharacterChoices({ traditional: '銀行', pinyin: 'yín háng' }, [
      { traditional: '銀型', pinyin: 'yín xíng' }, { traditional: '學生', pinyin: 'xué shēng' },
    ]);
    expect(choices).toHaveLength(4); expect(choices.map(c => c.traditional)).toContain('學生');
    expect(choices.map(c => c.traditional)).not.toContain('銀型');
  });
  it('requires all distractors to have disjoint known readings and excludes unverified entries', () => {
    const choices = buildCharacterChoices(target, [{ traditional: '樂', pinyin: 'lè' }, { traditional: '樂', pinyin: 'yuè' },
      { traditional: '月', pinyin: 'yuè' }, { traditional: '書', pinyin: 'shū' }, { traditional: '書', pinyin: '' }], () => .999);
    expect(choices).toHaveLength(4); expect(choices.map(c => c.traditional)).toContain('樂');
    expect(choices.map(c => c.traditional)).not.toContain('月'); expect(choices.map(c => c.traditional)).not.toContain('書');
    expect(buildCharacterChoices(target, [{ traditional: '仁', pinyin: 'rén' }])).toHaveLength(4);
    expect(() => buildCharacterChoices({ traditional: '人人人人', pinyin: 'rén rén rén rén' }, [target])).toThrow('Four verified');
  });
  it('rejects ambiguous or incomplete metadata and accepts normalized pinyin equivalents', () => {
    expect(parseRecallSchema(JSON.stringify(choiceSchema))).toEqual(choiceSchema);
    expect(parseRecallSchema(JSON.stringify({ ...choiceSchema, choices: [{ ...target, pinyin: 'ren2' }, choiceSchema.choices![1]] }))).toBeTruthy();
    for (const choices of [undefined, [target], [target, target], [target, { traditional: '忍', pinyin: 'rěn' }],
      [{ traditional: '書', pinyin: 'shū' }, { traditional: '國', pinyin: 'guó' }],
      [target, { traditional: '書', pinyin: 'shū' }, { traditional: '鼠', pinyin: 'shǔ' }]]) {
      expect(() => parseRecallSchema(JSON.stringify({ ...choiceSchema, choices }))).toThrow();
    }
  });
  it('keeps the native question free of target characters and checks exact first choices', () => {
    expect(recallFront(choiceSchema)).toBe('Choose the characters for: rén');
    expect(recallFront(choiceSchema)).not.toContain('人');
    expect(checkRecall(choiceSchema, '人')).toMatchObject({ passed: true, accuracy: 1, answer: '人' });
    expect(checkRecall(choiceSchema, '書')).toMatchObject({ passed: false, answer: '書' });
    expect(checkRecall(choiceSchema, '仁')).toMatchObject({ passed: false });
    expect(checkRecall(choiceSchema, 'ren2')).toMatchObject({ passed: false });
    expect(skillHistoryKey(choiceSchema)).not.toBe(skillHistoryKey({ ...choiceSchema, skill: 'pinyin' }));
  });
});

it('loads explicit vocabulary metadata through the Powerup, including alternate readings', async () => {
  const entries = [{ traditional: '人', pinyin: 'rén' }, { traditional: '仁', pinyin: 'ren2' },
    { traditional: '書', pinyin: 'shū' }, { traditional: '樂', pinyin: 'lè' }, { traditional: '樂', pinyin: 'rén' }];
  const getPowerupByCode = vi.fn(async () => ({ _id: 'powerup' }));
  const plugin = { powerup: { getPowerupByCode }, rem: { findOne: async (id: string) => id === 'powerup' ?
    { taggedRem: async () => entries.map((_e, i) => ({ _id: String(i) })) } :
    { getPowerupProperty: async () => JSON.stringify({ version: 2, ...entries[Number(id)] }) } } } as unknown as RNPlugin;
  const choices = await vocabularyCharacterChoices(plugin, entries[0]);
  expect(choices).toHaveLength(4); expect(choices).toContainEqual(entries[2]);
  expect(choices.some(c => c.traditional === '仁' || c.traditional === '樂')).toBe(false);
  expect(getPowerupByCode).toHaveBeenCalledWith('hanzi-vocabulary-v2');
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

it('binds both native translation directions to separate skill histories and hides the reverse answer', async () => {
  const {memoryRemNote}=await import('./helpers/remnote-memory');
  const {ensureTranslationCards}=await import('../src/services/recall');
  const a=memoryRemNote(), stored={...schema,skill:'english-to-chinese' as const,bidirectional:true};
  const [id]=await ensureTranslationCards(a.plugin,stored);
  expect(a.rems.get(id)!.setPracticeDirection).toHaveBeenLastCalledWith('both');
  expect(a.rems.get(id)!.setText).toHaveBeenLastCalledWith(['benevolence']);
  expect(a.rems.get(id)!.setBackText).toHaveBeenLastCalledWith(['仁']);
  let direction='forward';
  const api={...a.plugin,widget:{getWidgetContext:async()=>({remId:id,revealed:false})},
    queue:{getCurrentCard:async()=>({_id:direction,remId:id,type:direction,repetitionHistory:[]}),inLookbackMode:async()=>false,hasRevealedAnswer:async()=>false}} as unknown as RNPlugin;
  const forward=await readRecallContext(api); direction='backward';
  const reverse=await readRecallContext(api);
  expect(forward?.schema.skill).toBe('english-to-chinese'); expect(reverse?.schema.skill).toBe('chinese-to-english');
  expect(forward?.key).not.toBe(reverse?.key);
  expect(skillHistoryKey(forward!.schema)).not.toBe(skillHistoryKey(reverse!.schema));
  const {stillCurrent}=await import('../src/services/remnote');
  expect(await stillCurrent(api,'backward',true,0,'backward')).toBe(true);
  expect(await stillCurrent(api,'backward',true,0)).toBe(false);
});
