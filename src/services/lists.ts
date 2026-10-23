import type { RNPlugin } from '@remnote/plugin-sdk';
import { VOCAB_POWERUP, WRITING_POWERUP, SCHEMA_SLOT, parseWritingSchema } from '../core/schema';
import { RECALL_POWERUP, RECALL_SKILLS, parseRecallSchema } from '../core/recall';
import { ensureCollection } from './remnote';
type RemObject = NonNullable<Awaited<ReturnType<RNPlugin['rem']['findOne']>>>;

export interface VocabularyList { id: string; name: string }
const studyPowerups = [VOCAB_POWERUP, WRITING_POWERUP, RECALL_POWERUP];
async function isStudyRem(rem: RemObject): Promise<boolean> {
  for (const code of studyPowerups) if (await rem.hasPowerup(code)) return true;
  return false;
}
async function nameOf(plugin: RNPlugin, rem: RemObject): Promise<string> {
  return (await plugin.richText.toString(rem.text || [])).trim() || '(untitled bullet)';
}
/** Parent bullets are the list model. There is no separate list tag or membership database. */
export async function resolveListParent(plugin: RNPlugin, id?: string): Promise<string> {
  const parentId = id || await ensureCollection(plugin);
  const rem = await plugin.rem.findOne(parentId);
  if (!rem) throw new Error('The selected list bullet is unavailable. Refresh lists or select another bullet.');
  if (await isStudyRem(rem)) throw new Error('Use an ordinary parent bullet as a list, rather than a vocabulary entry or review card.');
  return parentId;
}
export async function vocabularyParent(plugin: RNPlugin, id: string): Promise<string> {
  const rem = await plugin.rem.findOne(id);
  if (!rem) throw new Error('The vocabulary entry is unavailable.');
  const parent = await rem.getParentRem();
  return resolveListParent(plugin, parent?._id);
}
export async function readVocabularyLists(plugin: RNPlugin, selectedId?: string): Promise<VocabularyList[]> {
  const rootId = await plugin.storage.getSynced<string>('hm:v2:collection');
  const root = rootId ? await plugin.rem.findOne(rootId) : undefined;
  const lists: VocabularyList[] = [{ id: root?._id || '', name: 'Hanzi Mastery (default)' }];
  if (root) {
    for (const reference of await root.getChildrenRem()) {
      const child = await plugin.rem.findOne(reference._id);
      if (child && !await isStudyRem(child)) lists.push({ id: child._id, name: await nameOf(plugin, child) });
    }
  }
  if (selectedId && !lists.some(list => list.id === selectedId)) {
    const selected = await plugin.rem.findOne(selectedId);
    if (selected && !await isStudyRem(selected)) lists.push({ id: selectedId, name: await nameOf(plugin, selected) });
  }
  return lists;
}
export async function createVocabularyList(plugin: RNPlugin, name: string, options: { resumeId?: string; onCreate?(id: string): void } = {}): Promise<string> {
  if (!name.trim()) throw new Error('Enter a name for the list bullet.');
  const root = await ensureCollection(plugin);
  const rem = options.resumeId ? await plugin.rem.findOne(options.resumeId) : await plugin.rem.createRem();
  if (!rem) throw new Error('RemNote could not create the list bullet.');
  options.onCreate?.(rem._id);
  await rem.setPracticeDirection('none');
  await rem.setText([name.trim()]); await rem.setParent(root);
  const confirmed = await plugin.rem.findOne(rem._id);
  if (!confirmed || confirmed.parent !== root || await nameOf(plugin, confirmed) !== name.trim()) {
    throw new Error('The list bullet was not confirmed. Keep this form open and retry.');
  }
  return rem._id;
}
/** Include registered drafts and older writing cards, without changing native scheduling or grades. */
async function linkedCardIds(plugin: RNPlugin, vocabularyId: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const skill of RECALL_SKILLS) {
    const link = await plugin.storage.getSynced<{ id: string }>(`hm:v3:card:${vocabularyId}:${skill}`);
    if (typeof link?.id === 'string') {
      const rem = await plugin.rem.findOne(link.id);
      if (!rem) continue;
      let schema: { vocabularyId?: unknown };
      try { schema = JSON.parse(await rem.getPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT)); }
      catch { continue; } // An unfinished draft may not have metadata yet.
      if (schema.vocabularyId !== vocabularyId) throw new Error('A linked card belongs to another vocabulary entry. No notes were moved.');
      ids.add(rem._id);
    }
  }
  for (const code of [WRITING_POWERUP, RECALL_POWERUP]) {
    const reference = await plugin.powerup.getPowerupByCode(code);
    const powerup = reference && await plugin.rem.findOne(reference._id);
    if (!powerup) continue;
    for (const tagged of await powerup.taggedRem()) {
      const rem = await plugin.rem.findOne(tagged._id);
      if (!rem || !await rem.hasPowerup(code)) continue;
      const raw = await rem.getPowerupProperty(code, SCHEMA_SLOT);
      let metadata: { vocabularyId?: unknown };
      try { metadata = JSON.parse(raw); } catch { continue; }
      if (metadata.vocabularyId !== vocabularyId) continue;
      if (code === WRITING_POWERUP) parseWritingSchema(raw); else parseRecallSchema(raw);
      ids.add(rem._id);
    }
  }
  return [...ids];
}
export async function moveVocabularyToList(plugin: RNPlugin, vocabularyId: string, listId?: string): Promise<string> {
  const parentId = await resolveListParent(plugin, listId);
  const vocabulary = await plugin.rem.findOne(vocabularyId);
  if (!vocabulary || !await vocabulary.hasPowerup(VOCAB_POWERUP)) throw new Error('The vocabulary entry is unavailable.');
  const ids = [vocabularyId, ...await linkedCardIds(plugin, vocabularyId)];
  const moving = new Set(ids), visited = new Set<string>();
  let ancestor = await plugin.rem.findOne(parentId);
  while (ancestor) {
    if (moving.has(ancestor._id) || visited.has(ancestor._id)) throw new Error('Choose a list outside this vocabulary entry and its cards. No notes were moved.');
    visited.add(ancestor._id); ancestor = await ancestor.getParentRem();
  }
  try {
    for (const id of ids) {
      const rem = await plugin.rem.findOne(id);
      if (!rem) throw new Error('A linked note is unavailable.');
      const destination = id === vocabularyId ? parentId : vocabularyId;
      if (rem.parent !== destination) await rem.setParent(destination);
      const confirmed = await plugin.rem.findOne(id);
      if (confirmed?.parent !== destination) throw new Error('Move was not confirmed.');
    }
  } catch { throw new Error('Some notes could not be moved and confirmed. Keep this list selected and retry to finish moving the vocabulary and its cards.'); }
  await sortVocabularyList(plugin, parentId);
  return parentId;
}
/** Character headings come first; other list bullets retain their relative order. */
export async function sortVocabularyList(plugin: RNPlugin, listId?: string): Promise<void> {
  const parentId = await resolveListParent(plugin, listId), parent = await plugin.rem.findOne(parentId);
  const entries: { id: string; characters: string; reading: string }[] = [];
  for (const child of await parent!.getChildrenRem()) {
    const rem = await plugin.rem.findOne(child._id);
    if (!rem || !await rem.hasPowerup(VOCAB_POWERUP)) continue;
    const value = JSON.parse(await rem.getPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT));
    if (typeof value.traditional !== 'string') throw new Error('A vocabulary heading has invalid character metadata.');
    entries.push({ id: rem._id, characters: value.traditional, reading: value.pinyin || '' });
  }
  const collator = new Intl.Collator('zh-Hant');
  entries.sort((a, b) => collator.compare(a.characters, b.characters) || a.reading.localeCompare(b.reading) || a.id.localeCompare(b.id));
  for (let i = 0; i < entries.length; i++) {
    const rem = await plugin.rem.findOne(entries[i].id);
    await rem!.setText([entries[i].characters]);
    await rem!.setParent(parentId, i);
  }
}
