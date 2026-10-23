import { expect, it } from 'vitest';
import { createVocabularyList, moveVocabularyToList, readVocabularyLists, resolveListParent, vocabularyParent } from '../src/services/lists';
import { VOCAB_POWERUP, WRITING_POWERUP, SCHEMA_SLOT } from '../src/core/schema';
import { RECALL_POWERUP } from '../src/core/recall';
import { ensureRecallCard } from '../src/services/recall';
import { createWritingCard } from '../src/services/remnote';
import { memoryRemNote } from './helpers/remnote-memory';
it('uses ordinary bullets, reads native renames and includes a focused external bullet without list metadata', async () => {
  const a=memoryRemNote(), listId=await createVocabularyList(a.plugin,'Lesson 1');
  const list=a.rems.get(listId)!;
  expect(list.parent).toBe('collection'); expect(list.addPowerup).not.toHaveBeenCalled(); expect(list.setIsDocument).not.toHaveBeenCalled();
  await list.setText(['Renamed lesson']);
  const external=a.add('external'); await external.setText(['Elsewhere']);
  const vocab=a.add('v'); await vocab.addPowerup(VOCAB_POWERUP); await vocab.setParent('collection');
  const card=a.add('card'); await card.addPowerup(RECALL_POWERUP); await card.setParent('collection');
  expect(await readVocabularyLists(a.plugin,'external')).toEqual([
    {id:'collection',name:'Hanzi Mastery (default)'},{id:listId,name:'Renamed lesson'},{id:'external',name:'Elsewhere'}]);
  await vocab.setParent('external'); expect(await vocabularyParent(a.plugin,'v')).toBe('external');
  await expect(resolveListParent(a.plugin,'card')).rejects.toThrow('ordinary parent bullet');
  expect([...a.saved.keys()]).toEqual(['hm:v2:collection']);
});
it('nests linked cards beneath their word, retries a partial move, and retains practice directions and histories', async () => {
  const a=memoryRemNote(), destination=await createVocabularyList(a.plugin,'Lesson 2');
  const v=a.add('v'); await v.addPowerup(VOCAB_POWERUP); await v.setParent('collection');
  await v.setPowerupProperty(VOCAB_POWERUP,SCHEMA_SLOT,[JSON.stringify({traditional:'人',pinyin:'rén'})]);
  const recall=await ensureRecallCard(a.plugin,{version:1,skill:'pinyin',vocabularyId:'v',traditional:'人',pinyin:'rén',meaning:'person'},'collection');
  const writing=await createWritingCard(a.plugin,{version:2,skill:'writing',vocabularyId:'v',traditional:'人',prompt:'person'},{parentId:'collection'});
  const unrelated=await createWritingCard(a.plugin,{version:2,skill:'writing',vocabularyId:'other',traditional:'人',prompt:'person'},{parentId:'collection'});
  const history={attempts:17}; a.saved.set('history',history);
  for(const id of ['v',recall,writing]) a.rems.get(id)!.setPracticeDirection.mockClear();
  a.rems.get(recall)!.setParent.mockRejectedValueOnce(new Error('Host offline'));
  await expect(moveVocabularyToList(a.plugin,'v',destination)).rejects.toThrow('retry');
  await moveVocabularyToList(a.plugin,'v',destination);
  for(const id of ['v',recall,writing]) {
    expect(a.rems.get(id)!.parent).toBe(id === 'v' ? destination : 'v'); expect(a.rems.get(id)!.setPracticeDirection).not.toHaveBeenCalled();
  }
  expect(a.rems.get(unrelated)!.parent).toBe('collection'); expect(a.saved.get('history')).toBe(history);
  expect(await a.rems.get(writing)!.getPowerupProperty(WRITING_POWERUP)).toContain('"vocabularyId":"v"');
});
it('refuses a destination beneath a linked card before moving any notes', async () => {
  const a=memoryRemNote(), v=a.add('v'); await v.addPowerup(VOCAB_POWERUP); await v.setParent('collection');
  const card=await ensureRecallCard(a.plugin,{version:1,skill:'pinyin',vocabularyId:'v',traditional:'人',pinyin:'rén',meaning:'person'},'collection');
  const descendant=a.add('descendant'); await descendant.setParent(card);
  v.setParent.mockClear(); a.rems.get(card)!.setParent.mockClear();
  await expect(moveVocabularyToList(a.plugin,'v','descendant')).rejects.toThrow('outside');
  expect(v.setParent).not.toHaveBeenCalled(); expect(a.rems.get(card)!.setParent).not.toHaveBeenCalled();
});

it('sorts word headings by Traditional characters and keeps ordinary bullets in their relative order', async () => {
  const a=memoryRemNote();
  for(const [id,traditional] of [['book','書'],['water','水'],['ten','十']]) {
    const rem=a.add(id); await rem.setParent('collection'); await rem.addPowerup(VOCAB_POWERUP);
    await rem.setPowerupProperty(VOCAB_POWERUP,SCHEMA_SLOT,[JSON.stringify({traditional,pinyin:''})]);
    await rem.setText(['Old verbose heading']);
  }
  for(const id of ['ordinary-a','ordinary-b']) await a.add(id).setParent('collection',99);
  const {sortVocabularyList}=await import('../src/services/lists');
  await sortVocabularyList(a.plugin,'collection');
  const ids=(await a.rems.get('collection')!.getChildrenRem()).map(r=>r._id);
  expect(ids.slice(0,3)).toEqual(['ten','water','book']);
  expect(ids.slice(3)).toEqual(['ordinary-a','ordinary-b']);
  expect(a.rems.get('book')!.text).toEqual(['書']);
});
