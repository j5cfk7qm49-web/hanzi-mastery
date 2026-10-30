import type { RNPlugin } from '@remnote/plugin-sdk';
import { SCHEMA_SLOT, VOCAB_POWERUP, type Vocabulary, type RecordingSource } from '../core/schema';
import { recordingMatches } from '../core/recordings';
import { dictionaryWordUrl, wiktionaryWordUrl } from '../core/dictionaryLinks';
import { findRecording } from './recordings';
import { validateVocabulary } from '../core/vocabulary';
import { STUDY_SKILLS, type StudySkill } from '../core/study';
import type { DictionaryCandidate } from './dictionary';
import { resolveListParent, vocabularyParent, sortVocabularyList } from './lists';
import { addVocabularyMembership, ensureLibrary, readLibrary, findLibraryEntry, wordIdentity, type LibraryEntry } from './library';
import { ensureCollection } from './remnote';
import { applyCardUpdates, planCardUpdates, ensureStudyCards, type CardEdit } from './cards';
import { serializeByKey } from './serial';
export { validateVocabulary } from '../core/vocabulary';

export async function readVocabulary(plugin: RNPlugin, id: string): Promise<Vocabulary> {
  const rem = await plugin.rem.findOne(id);
  if (!rem || !await rem.hasPowerup(VOCAB_POWERUP)) throw new Error('The vocabulary entry is unavailable.');
  const value = JSON.parse(await rem.getPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT)) as Vocabulary;
  validateVocabulary(value); return value;
}
export async function writeVocabulary(plugin: RNPlugin, id: string, value: Vocabulary, parent?: string): Promise<void> {
  validateVocabulary(value);
  const rem = await plugin.rem.findOne(id); if (!rem) throw new Error('The vocabulary entry is unavailable.');
  if (parent && rem.parent !== parent) await rem.setParent(parent);
  await rem.setText([value.traditional]); await rem.addPowerup(VOCAB_POWERUP);
  await rem.setPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT, [JSON.stringify(value)]);
  try {
    const confirmed = await readVocabulary(plugin, id), saved = await plugin.rem.findOne(id);
    if (JSON.stringify(confirmed) !== JSON.stringify(value) || (parent && saved?.parent !== parent)) throw new Error('Mismatch');
  } catch { throw new Error('Vocabulary save was not confirmed. Keep this form open and retry.'); }
}
export function updateVocabulary(plugin: RNPlugin, id: string, draft: Vocabulary, edits: Record<string, CardEdit> = {}): Promise<Vocabulary> {
  return serializeByKey(plugin.storage, `hm:v6:edit:${id}`, async () => {
    const old = await readVocabulary(plugin, id);
    const next: Vocabulary = { ...draft, ...(old.dictionary ? { dictionary: old.dictionary } : {}) };
    if (next.audioSource && (next.audio?.[0] !== next.audioSource.url || !recordingMatches(next.audioSource, next))) {
      if (next.audio?.[0] === next.audioSource.url) next.audio = next.audio.slice(1);
      delete next.audioSource;
    }
    validateVocabulary(next);
    // Persist the original baseline until the entire update completes. A retry must not
    // misclassify old generated prompts/audio as intentional customizations.
    const journalKey = `hm:v6:edit-baseline:${id}`;
    const pending = await plugin.storage.getSynced<Vocabulary>(journalKey);
    const baseline = pending || old;
    const updates = await planCardUpdates(plugin, id, baseline, next, edits, !!pending);
    await plugin.storage.setSynced(journalKey, baseline);
    await plugin.storage.setSynced(`hm:v6:edit-draft:${id}`, { word: next, edits });
    await writeVocabulary(plugin, id, next);
    await applyCardUpdates(plugin, updates);
    await sortVocabularyList(plugin, await vocabularyParent(plugin, id));
    await plugin.storage.setSynced(journalKey, null);
    await plugin.storage.setSynced(`hm:v6:edit-draft:${id}`, null);
    return next;
  });
}
export interface DictionaryImportSession { parentId: string; entries: Map<string, string>; library?: LibraryEntry[] }
export async function prepareDictionaryImport(plugin: RNPlugin, parentId?: string): Promise<DictionaryImportSession> {
  return { parentId: await resolveListParent(plugin, parentId), entries: new Map(), library: await readLibrary(plugin) };
}
export interface SavedVocabulary { id: string; vocabulary: Vocabulary; reused: boolean; cardErrors: string[]; audioNotice?: string }
export async function createVocabularyEntry(plugin: RNPlugin, value: Vocabulary, options: {
  parentId?: string; session?: DictionaryImportSession; separate?: boolean; resumeId?: string; onCreate?(id: string): void;
} = {}): Promise<Omit<SavedVocabulary, 'cardErrors'>> {
  validateVocabulary(value);
  const parent = await resolveListParent(plugin, options.parentId);
  if (options.session && options.session.parentId !== parent) throw new Error('The import list changed. Retry with the selected list.');
  const key = `hm:v6:word:${encodeURIComponent(wordIdentity(value))}`;
  return serializeByKey(plugin.storage, key, async () => {
    const inventory = options.session?.library || await readLibrary(plugin);
    const found = !options.separate && findLibraryEntry(inventory, value, parent);
    const saved = options.separate ? undefined : await plugin.storage.getSynced<{ id: string; complete: boolean }>(key);
    let rem = found ? await plugin.rem.findOne(found.id) : saved ? await plugin.rem.findOne(saved.id) : undefined;
    // A retry index is only a hint. Even an incomplete import may now contain a
    // finished or edited word; never overwrite it just because membership failed.
    let existingWord: Vocabulary | undefined;
    if (rem && !found && await rem.hasPowerup(VOCAB_POWERUP)) {
      const raw = await rem.getPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT);
      try { existingWord = JSON.parse(raw) as Vocabulary; validateVocabulary(existingWord); }
      catch (error) { existingWord = undefined; if (saved?.complete) throw error; }
      if (existingWord && wordIdentity(existingWord) !== wordIdentity(value)) { rem = undefined; existingWord = undefined; }
    }
    const reused = !!found || !!existingWord;
    if (options.separate && options.resumeId) rem = await plugin.rem.findOne(options.resumeId);
    if (!rem) {
      rem = await plugin.rem.createRem();
      if (!rem) throw new Error('RemNote could not create the vocabulary entry.');
      options.onCreate?.(rem._id);
    }
    if (!options.separate) await plugin.storage.setSynced(key, { id: rem._id, complete: false });
    const vocabulary = reused ? await readVocabulary(plugin, rem._id) : value;
    const library = await ensureLibrary(plugin);
    if (!reused) await writeVocabulary(plugin, rem._id, vocabulary, library);
    await addVocabularyMembership(plugin, rem._id, await ensureCollection(plugin));
    await addVocabularyMembership(plugin, rem._id, library);
    await addVocabularyMembership(plugin, rem._id, parent);
    if (!options.separate) await plugin.storage.setSynced(key, { id: rem._id, complete: true });
    if (options.session?.library && !options.session.library.some(entry => entry.id === rem!._id)) {
      options.session.library.push({ id: rem._id, vocabulary, parentId: rem.parent || undefined, lists: [parent] });
    }
    return { id: rem._id, vocabulary, reused };
  });
}
export async function importDictionaryCandidate(plugin: RNPlugin, candidate: DictionaryCandidate, options: {
  parentId?: string; session?: DictionaryImportSession; skills?: readonly StudySkill[]; findAudio?: boolean;
} = {}): Promise<SavedVocabulary> {
  const value: Vocabulary = { version: 2, traditional: candidate.traditional, ...(candidate.simplified ? { simplified: candidate.simplified } : {}),
    pinyin: candidate.pinyin, meanings: candidate.meanings,
    source: candidate.dictionary.english ? 'CC-CEDICT' : 'MOE Revised via Moedict; learner-supplied English', categories: [],
    dictionary: candidate.dictionary, dictionaryLinks: [dictionaryWordUrl(candidate.traditional), wiktionaryWordUrl(candidate.traditional),
      ...(candidate.dictionary.moe ? [candidate.dictionary.moe.url] : [])] };
  let audioNotice: string | undefined;
  // Existing shared words keep their current reading, audio and customizations.
  const known = options.session?.library?.some(entry => wordIdentity(entry.vocabulary) === wordIdentity(value));
  if (options.findAudio && !known && plugin.rootURL) {
    const key = `hm:v7:recording:${encodeURIComponent(JSON.stringify([value.traditional, value.simplified || '', value.pinyin]))}`;
    try {
      const cached = await plugin.storage.getSynced<RecordingSource>(key);
      const recording = recordingMatches(cached, value) ? cached : await findRecording(value, plugin.rootURL);
      if (recording) {
        value.audio = [recording.url]; value.audioSource = recording;
        // The vocabulary also retains provenance if a cache write cannot be saved.
        await plugin.storage.setSynced(key, recording).catch(() => {});
      } else audioNotice = 'No matching recording; add audio on the Word page.';
    } catch { audioNotice = 'Recording lookup unavailable; add audio on the Word page.'; }
  }
  const saved = await createVocabularyEntry(plugin, value, options);
  const cardErrors = await ensureStudyCards(plugin, saved.id, saved.vocabulary, options.skills || STUDY_SKILLS, {
    newEntry: !saved.reused, vocabulary: options.session?.library?.map(entry => entry.vocabulary),
  });
  return { ...saved, cardErrors, ...(!saved.reused && audioNotice ? { audioNotice } : {}) };
}
