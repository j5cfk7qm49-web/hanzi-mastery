import { expect, it, vi } from 'vitest';
import { memoryRemNote } from './helpers/remnote-memory';
import { createVocabularyEntry, readVocabulary, updateVocabulary } from '../src/services/vocabulary';
import { ensureStudyCards, ensureWritingCard, readStudyCards } from '../src/services/cards';
import { ensureLibrary, readLibrary } from '../src/services/library';
import { createVocabularyList } from '../src/services/lists';
import { STUDY_SKILLS, defaultWritingPrompt } from '../src/core/study';
import { recallTargetKey } from '../src/core/recall';
import { type Vocabulary } from '../src/core/schema';
import { SkillRepository, skillHistoryKey } from '../src/services/recall';
const word: Vocabulary = { version: 2, traditional: '學', pinyin: 'xué', meanings: ['study'], source: 'Manual', categories: [], audio: ['https://example.com/study.mp3'] };

it('creates every requested skill by default, then shares the same entry/cards across two lists', async () => {
  const a = memoryRemNote(), one = await createVocabularyList(a.plugin, 'Lesson 1'), two = await createVocabularyList(a.plugin, 'Lesson 2');
  const saved = await createVocabularyEntry(a.plugin, word, { parentId: one });
  expect(await ensureStudyCards(a.plugin, saved.id, saved.vocabulary, STUDY_SKILLS)).toEqual([]);
  const cards = await readStudyCards(a.plugin, saved.id), calls = a.createRem.mock.calls.length;
  expect(cards).toHaveLength(7); // One native Rem contains two translation directions.
  expect(cards.reduce((sum, card) => sum + (card.direction === 'both' ? 2 : 1), 0)).toBe(8);
  const reused = await createVocabularyEntry(a.plugin, { ...word, pinyin: 'xue2' }, { parentId: two });
  expect(reused.id).toBe(saved.id); expect(reused.reused).toBe(true);
  expect(await ensureStudyCards(a.plugin, saved.id, reused.vocabulary, STUDY_SKILLS)).toEqual([]);
  expect(a.createRem).toHaveBeenCalledTimes(calls);
  expect((await a.rems.get(saved.id)!.getTagRems()).map(tag => tag._id)).toEqual(expect.arrayContaining([one, two]));
});

it('uses the batch inventory to create skills for a new word without repeatedly scanning the knowledge base', async () => {
  const a = memoryRemNote(), saved = await createVocabularyEntry(a.plugin, word);
  const scan = vi.spyOn(a.plugin.powerup, 'getPowerupByCode');
  expect(await ensureStudyCards(a.plugin, saved.id, word, STUDY_SKILLS, { newEntry: true, vocabulary: [word] })).toEqual([]);
  expect(scan).not.toHaveBeenCalled();
  expect(await readStudyCards(a.plugin, saved.id)).toHaveLength(7);
});

it('updates default writing/recall cards, keeps custom cues/audio, and pins old result histories', async () => {
  const a = memoryRemNote(), saved = await createVocabularyEntry(a.plugin, word);
  await ensureStudyCards(a.plugin, saved.id, word, STUDY_SKILLS);
  const cards = await readStudyCards(a.plugin, saved.id), translation = cards.find(card => card.schema.skill === 'english-to-chinese')!;
  if (translation.schema.skill === 'writing') throw new Error('fixture');
  const repository = new SkillRepository(a.plugin.storage), oldKey = skillHistoryKey(translation.schema), oldMastery = recallTargetKey(translation.schema);
  await repository.save(translation.schema, { id: 'first', at: 1, cardId: translation.id, result: { passed: true, accuracy: 1, total: 1, spellingCorrect: 0, tonesCorrect: 0, assessment: 'checked' } });
  const pinyin = cards.find(card => card.schema.skill === 'pinyin')!, listening = cards.find(card => card.schema.skill === 'listening')!;
  for (const card of cards) a.rems.get(card.id)!.setPracticeDirection.mockClear();
  await updateVocabulary(a.plugin, saved.id, { ...word, meanings: ['to learn'], audio: ['https://example.com/new.mp3'] }, {
    [pinyin.id]: { prompt: 'Read this word aloud, then type its pinyin.' }, [listening.id]: { audio: 'https://example.com/custom.mp3' },
  });
  const updated = await readStudyCards(a.plugin, saved.id);
  const writing = updated.find(card => card.schema.skill === 'writing')!;
  expect(writing.schema).toMatchObject({ prompt: 'to learn (xué)', customPrompt: false });
  const schema = updated.find(card => card.id === translation.id)!.schema;
  if (schema.skill === 'writing') throw new Error('fixture');
  expect(skillHistoryKey(schema)).toBe(oldKey); expect(recallTargetKey(schema)).toBe(oldMastery);
  expect(await repository.load(schema)).toMatchObject({ attempts: 1, passed: 1 });
  expect(updated.find(card => card.id === listening.id)!.schema).toMatchObject({ referenceAudio: 'https://example.com/custom.mp3', customAudio: true });
  await updateVocabulary(a.plugin, saved.id, { ...word, meanings: ['learn something'], audio: ['https://example.com/latest.mp3'] });
  expect((await readStudyCards(a.plugin, saved.id)).find(card => card.id === pinyin.id)!.schema).toMatchObject({ customPrompt: 'Read this word aloud, then type its pinyin.' });
  for (const card of cards) expect(a.rems.get(card.id)!.setPracticeDirection).not.toHaveBeenCalled();
});

it('keeps a deliberate writing cue and retries a partial update without changing its classification or history', async () => {
  const a = memoryRemNote(), saved = await createVocabularyEntry(a.plugin, word);
  await ensureStudyCards(a.plugin, saved.id, word, STUDY_SKILLS);
  const cards = await readStudyCards(a.plugin, saved.id), writing = cards.find(card => card.schema.skill === 'writing')!;
  await a.rems.get(writing.id)!.setParent('collection');
  a.fail('english-to-chinese');
  await expect(updateVocabulary(a.plugin, saved.id, { ...word, meanings: ['learn'] })).rejects.toThrow('some linked study cards');
  expect(a.saved.get(`hm:v6:edit-draft:${saved.id}`)).toMatchObject({ word: { meanings: ['learn'] } });
  await updateVocabulary(a.plugin, saved.id, { ...word, meanings: ['learn'] });
  expect(a.saved.get(`hm:v6:edit-draft:${saved.id}`)).toBeNull();
  expect((await readStudyCards(a.plugin, saved.id)).find(card => card.id === writing.id)!.outsideWord).toBe(true);
  expect(a.rems.get(writing.id)!.parent).toBe('collection');
  expect((await readStudyCards(a.plugin, saved.id)).find(card => card.id === writing.id)!.schema).toMatchObject({ prompt: 'learn (xué)', customPrompt: false });
  await updateVocabulary(a.plugin, saved.id, { ...word, meanings: ['learn'] }, { [writing.id]: { prompt: 'Write the word from our lesson.' } });
  await updateVocabulary(a.plugin, saved.id, { ...word, meanings: ['study again'] });
  expect((await readStudyCards(a.plugin, saved.id)).find(card => card.id === writing.id)!.schema).toMatchObject({ prompt: 'Write the word from our lesson.', customPrompt: true });
});

it('detects native answer edits before writing and restores them only on explicit choice', async () => {
  const a = memoryRemNote(), saved = await createVocabularyEntry(a.plugin, word);
  await ensureStudyCards(a.plugin, saved.id, word, ['pinyin']);
  const [card] = await readStudyCards(a.plugin, saved.id);
  await a.rems.get(card.id)!.setBackText(['user changed this answer']);
  await expect(updateVocabulary(a.plugin, saved.id, { ...word, meanings: ['learn'] })).rejects.toThrow('answer was edited');
  expect((await readVocabulary(a.plugin, saved.id)).meanings).toEqual(['study']);
  await updateVocabulary(a.plugin, saved.id, { ...word, meanings: ['learn'] }, { [card.id]: { restoreAnswer: true } });
  expect(a.rems.get(card.id)!.backText.join('')).toContain('learn');
});

it('reimports leave paused directions and custom cues intact', async () => {
  const a = memoryRemNote(), saved = await createVocabularyEntry(a.plugin, word);
  await ensureStudyCards(a.plugin, saved.id, word, STUDY_SKILLS);
  const cards = await readStudyCards(a.plugin, saved.id), pinyin = cards.find(card => card.schema.skill === 'pinyin')!;
  await updateVocabulary(a.plugin, saved.id, word, { [pinyin.id]: { prompt: 'My cue', direction: 'none' } });
  await ensureStudyCards(a.plugin, saved.id, word, STUDY_SKILLS);
  expect(await a.rems.get(pinyin.id)!.getPracticeDirection()).toBe('none');
  expect((await readStudyCards(a.plugin, saved.id)).find(card => card.id === pinyin.id)!.schema).toMatchObject({ customPrompt: 'My cue' });
});

it('resumes writing and library creation without duplicate Rems after a host failure', async () => {
  const a = memoryRemNote(); a.saved.delete('hm:v6:library');
  const draft = a.add('library-draft'); a.saved.set('hm:v6:library-draft', draft._id);
  draft.setIsDocument.mockRejectedValueOnce(new Error('offline'));
  await expect(ensureLibrary(a.plugin)).rejects.toThrow('offline');
  expect(await ensureLibrary(a.plugin)).toBe(draft._id); expect(a.createRem).not.toHaveBeenCalled();
  const saved = await createVocabularyEntry(a.plugin, word), schema = { version: 2 as const, skill: 'writing' as const, vocabularyId: saved.id, traditional: word.traditional, prompt: defaultWritingPrompt(word) };
  a.fail('writing'); await expect(ensureWritingCard(a.plugin, schema)).rejects.toThrow('temporary');
  const count = a.createRem.mock.calls.length;
  await ensureWritingCard(a.plugin, schema); await ensureWritingCard(a.plugin, schema);
  expect(a.createRem).toHaveBeenCalledTimes(count);
});

it('preserves intentional duplicates and requires a choice instead of merging histories', async () => {
  const a = memoryRemNote();
  const one = await createVocabularyEntry(a.plugin, word), two = await createVocabularyEntry(a.plugin, word, { separate: true });
  expect(one.id).not.toBe(two.id);
  await expect(createVocabularyEntry(a.plugin, word)).rejects.toThrow('Several existing entries');
  expect(await readLibrary(a.plugin)).toHaveLength(2);
});

it('stops authoring when existing membership cannot be read instead of creating a duplicate', async () => {
  const a = memoryRemNote(), saved = await createVocabularyEntry(a.plugin, word);
  const count = a.createRem.mock.calls.length;
  vi.spyOn(a.rems.get(saved.id)!, 'getTagRems').mockRejectedValueOnce(new Error('connection lost'));
  await expect(createVocabularyEntry(a.plugin, word)).rejects.toThrow('connection lost');
  expect(a.createRem).toHaveBeenCalledTimes(count);
});

it('does not overwrite an edited entry referenced by a stale incomplete import index', async () => {
  const a = memoryRemNote(), saved = await createVocabularyEntry(a.plugin, word);
  const index = [...a.saved.keys()].find(key => key.startsWith('hm:v6:word:'))!;
  a.saved.set(index, { id: saved.id, complete: false });
  await updateVocabulary(a.plugin, saved.id, { ...word, traditional: '書', pinyin: 'shū', meanings: ['book'] });
  const another = await createVocabularyEntry(a.plugin, word);
  expect(another.id).not.toBe(saved.id);
  expect((await readVocabulary(a.plugin, saved.id)).traditional).toBe('書');
});

it('includes a legacy entry in the native master document without moving or duplicating it', async () => {
  const a = memoryRemNote(), saved = await createVocabularyEntry(a.plugin, word);
  const originalParent = a.rems.get(saved.id)!.parent;
  a.saved.delete('hm:v6:library');
  const reused = await createVocabularyEntry(a.plugin, word);
  const library = a.saved.get('hm:v6:library');
  expect(reused.id).toBe(saved.id);
  expect(a.rems.get(saved.id)!.parent).toBe(originalParent);
  expect((await a.rems.get(saved.id)!.getTagRems()).map(tag => tag._id)).toContain(library);
});
