import { expect, it } from 'vitest';
import { importDictionaryCandidate, prepareDictionaryImport, readVocabulary, updateVocabulary } from '../src/services/vocabulary';
import { memoryRemNote as api } from './helpers/remnote-memory';
import { createVocabularyList, moveVocabularyToList } from '../src/services/lists';
import type { DictionaryCandidate } from '../src/services/dictionary';
const candidate: DictionaryCandidate = { traditional: '學', simplified: '学', pinyin: 'xué', meanings: ['to study'], dictionary: {
  importedAt: '2026-10-21', moe: { provider: 'MOE Revised via Moedict', url: 'https://www.moedict.tw/uni/學', pinyin: 'xué', bopomofo: 'ㄒㄩㄝˊ',
    definitions: ['研習、學習。'], license: 'CC BY-ND 3.0 TW', edition: 'Test source' },
  english: { provider: 'CC-CEDICT', url: 'https://www.mdbg.net/chinese/dictionary?page=cedict', snapshot: 'Test snapshot', pinyin: 'xue2', definitions: ['to study'], license: 'CC BY-SA 4.0' },
} };
it('imports one vocabulary entry and one bidirectional card, reusing them on concurrent retries', async () => {
  const a = api();
  const [first, second] = await Promise.all([importDictionaryCandidate(a.plugin, candidate), importDictionaryCandidate(a.plugin, candidate)]);
  expect(first.id).toBe(second.id); expect(a.createRem).toHaveBeenCalledTimes(2);
  expect(first.vocabulary.dictionary).toEqual(candidate.dictionary);
  for (const skill of ['english-to-chinese']) expect(a.saved.get(`hm:v3:card:${first.id}:${skill}`)).toMatchObject({ complete: true });
});
it('resumes a partially imported card without duplicating the vocabulary or successful card', async () => {
  const a = api(); a.fail('english-to-chinese');
  await expect(importDictionaryCandidate(a.plugin, candidate)).rejects.toThrow('temporary');
  await importDictionaryCandidate(a.plugin, candidate);
  expect(a.createRem).toHaveBeenCalledTimes(2);
});
it('updates existing study cards in place, keeps original dictionary records and preserves edited data on reimport', async () => {
  const a = api(), original = await importDictionaryCandidate(a.plugin, candidate);
  const cards = [...a.rems.values()].filter(rem => rem.parent === original.id);
  cards.forEach(rem => { rem.setPracticeDirection.mockClear(); rem.setParent.mockClear(); });
  const edited = await updateVocabulary(a.plugin, original.id, { ...original.vocabulary, meanings: ['to learn'], pinyin: 'xue2', dictionary: undefined });
  expect(edited.dictionary).toEqual(candidate.dictionary);
  for (const card of cards) {
    expect(JSON.parse(await card.getPowerupProperty()).meaning).toBe('to learn');
    expect(card.setPracticeDirection).not.toHaveBeenCalled(); expect(card.setParent).not.toHaveBeenCalled();
  }
  const repeated = await importDictionaryCandidate(a.plugin, candidate);
  expect(repeated.vocabulary.meanings).toEqual(['to learn']); expect(repeated.vocabulary.pinyin).toBe('xue2');
  expect(a.createRem).toHaveBeenCalledTimes(2);
});
it('reports partial update failures and lets a retry finish the remaining linked cards', async () => {
  const a = api(), original = await importDictionaryCandidate(a.plugin, candidate);
  const draft = { ...original.vocabulary, meanings: ['to learn'] };
  a.fail('english-to-chinese');
  await expect(updateVocabulary(a.plugin, original.id, draft)).rejects.toThrow('some linked study cards');
  expect((await readVocabulary(a.plugin, original.id)).meanings).toEqual(['to learn']);
  await updateVocabulary(a.plugin, original.id, draft);
  const repeated = await importDictionaryCandidate(a.plugin, candidate);
  expect(repeated.vocabulary.meanings).toEqual(['to learn']); expect(a.createRem).toHaveBeenCalledTimes(2);
});
it('rejects invalid edits before writing vocabulary or changing linked schedules', async () => {
  const a = api(), original = await importDictionaryCandidate(a.plugin, candidate);
  await expect(updateVocabulary(a.plugin, original.id, { ...original.vocabulary, meanings: [] })).rejects.toThrow('English study meaning');
  expect((await readVocabulary(a.plugin, original.id)).meanings).toEqual(['to study']);
});
it('scopes repeated imports to native list bullets and reuses an entry after a native move', async () => {
  const a=api(), firstList=await createVocabularyList(a.plugin,'Lesson 1'), secondList=await createVocabularyList(a.plugin,'Lesson 2');
  const first=await importDictionaryCandidate(a.plugin,candidate,{parentId:firstList});
  await moveVocabularyToList(a.plugin,first.id,secondList);
  const afterMove=await importDictionaryCandidate(a.plugin,candidate,{parentId:secondList});
  expect(afterMove.id).toBe(first.id);
  const another=await importDictionaryCandidate(a.plugin,candidate,{parentId:firstList});
  expect(another.id).not.toBe(first.id);
  expect(a.rems.get(first.id)!.parent).toBe(secondList);
  expect(a.rems.get(another.id)!.parent).toBe(firstList);
  expect(a.createRem).toHaveBeenCalledTimes(6);
});
it('inventories a list once per batch and reuses original flat imports without overwriting edits', async () => {
  const a=api(), first=await importDictionaryCandidate(a.plugin,candidate);
  for (const key of a.saved.keys()) if(key.startsWith('hm:v5:dictionary:')) {
    const value=a.saved.get(key); a.saved.delete(key);
    a.saved.set(`hm:v4:dictionary:${encodeURIComponent(JSON.stringify(['學','xue2']))}`,value);
  }
  const session=await prepareDictionaryImport(a.plugin);
  const reads=a.rems.get('collection')!.getChildrenRem; reads.mockClear();
  expect((await importDictionaryCandidate(a.plugin,candidate,{session})).id).toBe(first.id);
  const other={...candidate,traditional:'習',pinyin:'xí',dictionary:{...candidate.dictionary,
    moe:{...candidate.dictionary.moe,pinyin:'xí',url:'https://www.moedict.tw/uni/習'}}};
  await importDictionaryCandidate(a.plugin,other,{session});
  await importDictionaryCandidate(a.plugin,other,{session});
  expect(reads).not.toHaveBeenCalled(); expect(a.createRem).toHaveBeenCalledTimes(4);
});

it('keeps legacy translation cards and disabled directions when grouping a repeated import', async () => {
  const a=api(), {ensureRecallCard}=await import('../src/services/recall');
  const original=await importDictionaryCandidate(a.plugin,candidate);
  const bothKey=`hm:v3:card:${original.id}:english-to-chinese`;
  const combined=(a.saved.get(bothKey) as {id:string}).id;
  // Model an older installation with two existing, independently scheduled Rems.
  a.saved.delete(bothKey); a.rems.delete(combined);
  const ids=[];
  for(const skill of ['english-to-chinese','chinese-to-english'] as const) ids.push(await ensureRecallCard(a.plugin,{version:1,skill,vocabularyId:original.id,traditional:'學',pinyin:'xué',meaning:'to study'},'collection'));
  for(const id of ids) a.rems.get(id)!.setPracticeDirection.mockClear();
  const calls=a.createRem.mock.calls.length;
  await importDictionaryCandidate(a.plugin,candidate);
  expect(a.createRem).toHaveBeenCalledTimes(calls);
  for(const id of ids) {
    expect(a.rems.get(id)!.parent).toBe(original.id);
    expect(a.rems.get(id)!.setPracticeDirection).not.toHaveBeenCalled();
  }
});
