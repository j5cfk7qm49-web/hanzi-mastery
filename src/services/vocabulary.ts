import type { RNPlugin } from '@remnote/plugin-sdk';
import { characters, SCHEMA_SLOT, VOCAB_POWERUP, type Vocabulary } from '../core/schema';
import { parsePinyin, parseRecallSchema, pinyinKey, RECALL_SKILLS, type RecallSchema } from '../core/recall';
import { ensureRecallCard, ensureTranslationCards, vocabularyCharacterChoices } from './recall';
import type { DictionaryCandidate } from './dictionary';
import { resolveListParent, vocabularyParent, moveVocabularyToList, sortVocabularyList } from './lists';

export function validateVocabulary(v: Vocabulary): void {
  if (!v || v.version !== 2 || typeof v.traditional !== 'string' || typeof v.pinyin !== 'string' ||
      !Array.isArray(v.meanings) || !v.meanings.length || !v.meanings.every(m => typeof m === 'string' && m.trim() && !/\p{Script=Han}/u.test(m)) ||
      typeof v.source !== 'string' || !Array.isArray(v.categories) || !v.categories.every(c => typeof c === 'string')) throw new Error('Supply characters and at least one English study meaning.');
  characters(v.traditional); if (v.simplified) characters(v.simplified);
  if (v.pinyin.trim() && parsePinyin(v.pinyin).length !== Array.from(v.traditional).length) throw new Error('Provide one pinyin syllable per character.');
}
export async function readVocabulary(plugin: RNPlugin, id: string): Promise<Vocabulary> {
  const rem = await plugin.rem.findOne(id);
  if (!rem || !await rem.hasPowerup(VOCAB_POWERUP)) throw new Error('The vocabulary entry is unavailable.');
  const value = JSON.parse(await rem.getPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT)) as Vocabulary;
  validateVocabulary(value); return value;
}
async function writeVocabulary(plugin: RNPlugin, id: string, value: Vocabulary, parent?: string): Promise<void> {
  validateVocabulary(value);
  const rem = await plugin.rem.findOne(id); if (!rem) throw new Error('The vocabulary entry is unavailable.');
  if (parent) await rem.setParent(parent);
  await rem.setText([value.traditional]);
  await rem.addPowerup(VOCAB_POWERUP);
  await rem.setPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT, [JSON.stringify(value)]);
  if (JSON.stringify(await readVocabulary(plugin, id)) !== JSON.stringify(value)) throw new Error('Vocabulary save was not confirmed. Keep this form open and retry.');
}
export async function updateVocabulary(plugin: RNPlugin, id: string, draft: Vocabulary): Promise<Vocabulary> {
  const old = await readVocabulary(plugin, id);
  const next: Vocabulary = { ...draft, ...(old.dictionary ? { dictionary: old.dictionary } : {}) };
  validateVocabulary(next);
  const updates: RecallSchema[] = [];
  for (const skill of RECALL_SKILLS) {
    const link = await plugin.storage.getSynced<{ id: string; complete: boolean }>(`hm:v3:card:${id}:${skill}`);
    if (!link?.complete) continue;
    const rem = await plugin.rem.findOne(link.id); if (!rem) continue;
    if (!await rem.hasPowerup('hanzi-recall-v1')) throw new Error('A linked study card has changed type. No vocabulary was changed.');
    const previous = parseRecallSchema(await rem.getPowerupProperty('hanzi-recall-v1', SCHEMA_SLOT));
    if (previous.vocabularyId !== id || previous.skill !== skill) throw new Error('A study-card link points to another item. No vocabulary was changed.');
    const changedReading = previous.traditional !== next.traditional || previous.pinyin !== next.pinyin;
    const schema = { ...previous, traditional: next.traditional, pinyin: next.pinyin, meaning: next.meanings.join('; ') };
    if (skill === 'character-choice' && changedReading) schema.choices = await vocabularyCharacterChoices(plugin, next);
    updates.push(parseRecallSchema(JSON.stringify(schema)));
  }
  await writeVocabulary(plugin, id, next);
  try {
    if (updates.length) {
      for (const schema of updates) await ensureRecallCard(plugin, schema, id);
    }
    await moveVocabularyToList(plugin, id, await vocabularyParent(plugin, id));
  } catch { throw new Error('Vocabulary is saved, but some linked study cards still need updating. Keep this form open and save again to finish.'); }
  return next;
}
const importLocks = new Map<string, Promise<unknown>>();
export interface DictionaryImportSession { parentId: string; entries: Map<string, string> }
const dictionaryIdentity = (url: string, pinyin: string) => JSON.stringify([url, pinyinKey(parsePinyin(pinyin))]);
/** Read a list once per batch instead of scanning all existing notes for every new word. */
export async function prepareDictionaryImport(plugin: RNPlugin, parentId?: string): Promise<DictionaryImportSession> {
  const parent = await resolveListParent(plugin, parentId), entries = new Map<string, string>();
  const list = await plugin.rem.findOne(parent);
  for (const reference of await list!.getChildrenRem()) {
    const rem = await plugin.rem.findOne(reference._id);
    if (!rem || !await rem.hasPowerup(VOCAB_POWERUP)) continue;
    try {
      const value = JSON.parse(await rem.getPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT)) as Vocabulary;
      if (value.dictionary?.moe) entries.set(dictionaryIdentity(value.dictionary.moe.url, value.dictionary.moe.pinyin), rem._id);
    } catch { /* Unrelated drafts cannot supply a completed source identity. */ }
  }
  return { parentId: parent, entries };
}
export async function importDictionaryCandidate(plugin: RNPlugin, candidate: DictionaryCandidate, options: { parentId?: string; session?: DictionaryImportSession } = {}): Promise<{ id: string; vocabulary: Vocabulary }> {
  const value: Vocabulary = { version: 2, traditional: candidate.traditional, ...(candidate.simplified ? { simplified: candidate.simplified } : {}),
    pinyin: candidate.pinyin, meanings: candidate.meanings,
    source: candidate.dictionary.english ? 'MOE Revised via Moedict; CC-CEDICT English' : 'MOE Revised via Moedict; learner-supplied English', categories: [],
    dictionary: candidate.dictionary, dictionaryLinks: [candidate.dictionary.moe.url, ...(candidate.dictionary.english ? [candidate.dictionary.english.url] : [])] };
  validateVocabulary(value);
  const parent = await resolveListParent(plugin, options.parentId);
  if (options.session && options.session.parentId !== parent) throw new Error('The import list changed. Start the import again with the selected list.');
  const reading = pinyinKey(parsePinyin(candidate.dictionary.moe.pinyin));
  const key = `hm:v5:dictionary:${encodeURIComponent(JSON.stringify([parent, candidate.traditional, reading]))}`;
  const run = async () => {
    let link = await plugin.storage.getSynced<{ id: string; complete: boolean }>(key);
    if (!link && parent === await plugin.storage.getSynced<string>('hm:v2:collection')) {
      // Existing flat imports still reuse their original vocabulary/cards.
      link = await plugin.storage.getSynced(`hm:v4:dictionary:${encodeURIComponent(JSON.stringify([candidate.traditional, reading]))}`);
    }
    if (link && (typeof link.id !== 'string' || typeof link.complete !== 'boolean')) throw new Error('The dictionary import link is invalid. No entry was changed.');
    let rem = link ? await plugin.rem.findOne(link.id) : undefined;
    if (rem && link?.complete && rem.parent !== parent) { rem = undefined; link = undefined; }
    if (!rem) {
      // Native drag-and-drop can change membership without touching the import index.
      const session = options.session || await prepareDictionaryImport(plugin, parent);
      const found = session.entries.get(dictionaryIdentity(candidate.dictionary.moe.url, candidate.dictionary.moe.pinyin));
      const entry = found ? await plugin.rem.findOne(found) : undefined;
      if (entry?.parent === parent) {
        rem = entry; link = { id: entry._id, complete: true };
      }
    }
    let vocabulary = value;
    if (rem && link?.complete) vocabulary = await readVocabulary(plugin, rem._id);
    else {
      if (!rem) rem = await plugin.rem.createRem();
      if (!rem) throw new Error('RemNote could not create the vocabulary entry.');
      await plugin.storage.setSynced(key, { id: rem._id, complete: false });
      await writeVocabulary(plugin, rem._id, value, parent);
      await plugin.storage.setSynced(key, { id: rem._id, complete: true });
    }
    await ensureTranslationCards(plugin, { version: 1, vocabularyId: rem._id, traditional: vocabulary.traditional,
      pinyin: vocabulary.pinyin, meaning: vocabulary.meanings.join('; ') });
    if (!options.session) await sortVocabularyList(plugin, parent);
    await plugin.storage.setSynced(key, { id: rem._id, complete: true });
    options.session?.entries.set(dictionaryIdentity(candidate.dictionary.moe.url, candidate.dictionary.moe.pinyin), rem._id);
    return { id: rem._id, vocabulary };
  };
  const pending = (importLocks.get(key) || Promise.resolve()).catch(() => {}).then(run);
  importLocks.set(key, pending);
  void pending.finally(() => { if (importLocks.get(key) === pending) importLocks.delete(key); }).catch(() => {});
  return pending;
}
