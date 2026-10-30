import type { RNPlugin } from '@remnote/plugin-sdk';
import { SCHEMA_SLOT, VOCAB_POWERUP, type Vocabulary } from '../core/schema';
import { parsePinyin, pinyinKey } from '../core/recall';
import { validateVocabulary } from '../core/vocabulary';
import { ensureCollection } from './remnote';
import { serializeByKey } from './serial';

export interface LibraryEntry { id: string; vocabulary: Vocabulary; parentId?: string; lists: string[] }
export const wordIdentity = (v: Pick<Vocabulary, 'traditional' | 'pinyin'>) => JSON.stringify([
  v.traditional, v.pinyin.trim() ? pinyinKey(parsePinyin(v.pinyin)) : '',
]);
export function ensureLibrary(plugin: RNPlugin): Promise<string> {
  return serializeByKey(plugin.storage, 'hm:v6:library', async () => {
    const saved = await plugin.storage.getSynced<string>('hm:v6:library');
    if (saved && await plugin.rem.findOne(saved)) return saved;
    const draft = await plugin.storage.getSynced<string>('hm:v6:library-draft');
    const root = await ensureCollection(plugin), rem = (draft && await plugin.rem.findOne(draft)) || await plugin.rem.createRem();
    if (!rem) throw new Error('Could not create the vocabulary library.');
    // Reserve before setup so interrupted creation resumes the same document.
    await plugin.storage.setSynced('hm:v6:library-draft', rem._id);
    await rem.setText(['All words and characters']); await rem.setIsDocument(true); await rem.setParent(root);
    await plugin.storage.setSynced('hm:v6:library', rem._id);
    return rem._id;
  });
}
export async function addVocabularyMembership(plugin: RNPlugin, id: string, listId: string): Promise<void> {
  const rem = await plugin.rem.findOne(id);
  if (!rem) throw new Error('The vocabulary entry is unavailable.');
  const tags = await rem.getTagRems();
  if (!tags.some(tag => tag._id === listId)) await rem.addTag(listId);
  if (!(await rem.getTagRems()).some(tag => tag._id === listId)) throw new Error('List membership was not confirmed. Retry adding this entry.');
  await serializeByKey(plugin.storage, 'hm:v6:lists', async () => {
    const lists = await plugin.storage.getSynced<string[]>('hm:v6:lists') || [];
    if (!lists.includes(listId)) await plugin.storage.setSynced('hm:v6:lists', [...lists, listId]);
  });
}
export async function readLibrary(plugin: RNPlugin): Promise<LibraryEntry[]> {
  const reference = await plugin.powerup.getPowerupByCode(VOCAB_POWERUP);
  const powerup = reference && await plugin.rem.findOne(reference._id);
  if (!powerup) return [];
  const entries: LibraryEntry[] = [];
  for (const ref of await powerup.taggedRem()) {
    const rem = await plugin.rem.findOne(ref._id);
    if (!rem) continue;
    const raw = await rem.getPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT);
    let vocabulary: Vocabulary;
    try { vocabulary = JSON.parse(raw) as Vocabulary; validateVocabulary(vocabulary); }
    catch { continue; /* Incomplete drafts remain retryable through their authoring registry. */ }
    // Host failures must stop authoring instead of making an existing word appear absent.
    entries.push({ id: rem._id, vocabulary, parentId: rem.parent || undefined, lists: (await rem.getTagRems()).map(tag => tag._id) });
  }
  return entries.sort((a, b) => a.vocabulary.traditional.localeCompare(b.vocabulary.traditional, 'zh-Hant') || a.vocabulary.pinyin.localeCompare(b.vocabulary.pinyin));
}
export function findLibraryEntry(entries: LibraryEntry[], word: Vocabulary, listId?: string): LibraryEntry | undefined {
  const sourceReadings = (value: Vocabulary) => (value.dictionary?.english?.pinyin || '').split(' / ').flatMap(reading => {
    try { return [pinyinKey(parsePinyin(reading))]; } catch { return []; }
  });
  const originalReadings = sourceReadings(word);
  const matching = entries.filter(entry => wordIdentity(entry.vocabulary) === wordIdentity(word) ||
    (word.dictionary?.moe && entry.vocabulary.dictionary?.moe?.url === word.dictionary.moe.url &&
      pinyinKey(parsePinyin(entry.vocabulary.dictionary.moe.pinyin)) === pinyinKey(parsePinyin(word.dictionary.moe.pinyin))) ||
    (entry.vocabulary.traditional === word.traditional && originalReadings.some(reading => sourceReadings(entry.vocabulary).includes(reading))));
  if (matching.length < 2) return matching[0];
  const inList = matching.filter(entry => entry.parentId === listId || entry.lists.includes(listId || ''));
  if (inList.length === 1) return inList[0];
  throw new Error('Several existing entries match this word. Open the intended entry in the library and add it to this list; existing histories have been kept separate.');
}
