import { WidgetLocation, type RNPlugin } from '@remnote/plugin-sdk';
import { SCHEMA_SLOT, VOCAB_POWERUP } from '../core/schema';
import { RECALL_POWERUP, parseRecallSchema, recallFront, recallTargetKey, type CharacterChoice, type RecallSchema, type RecallResult } from '../core/recall';
import { buildCharacterChoices } from '../core/characterChoices';
import type { SyncedStore } from './persistence';

export interface RecallContext { cardId: string; schema: RecallSchema; revealed: boolean; reviewAt: number; key: string; direction?: 'forward' | 'backward' }
/** Use the vocabulary Powerup, rather than guessing readings from native question/answer text. */
export async function vocabularyCharacterChoices(plugin: RNPlugin, target: CharacterChoice): Promise<CharacterChoice[]> {
  const powerupRef = await plugin.powerup.getPowerupByCode(VOCAB_POWERUP);
  const powerup = powerupRef && await plugin.rem.findOne(powerupRef._id);
  if (!powerup) throw new Error('Hanzi Vocabulary is unavailable. Reopen the workbench and retry.');
  const tagged = await powerup.taggedRem();
  const entries: CharacterChoice[] = [];
  for (let offset = 0; offset < tagged.length; offset += 16) {
    const batch = await Promise.all(tagged.slice(offset, offset + 16).map(async ref => {
      const rem = await plugin.rem.findOne(ref._id);
      if (!rem) throw new Error('A vocabulary entry is unavailable. Retry before creating character choices.');
      const value = JSON.parse(await rem.getPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT));
      if (!value || value.version !== 2 || typeof value.traditional !== 'string') {
        throw new Error('A Hanzi Vocabulary entry has invalid metadata. Repair it before creating character choices.');
      }
      return { traditional: value.traditional, pinyin: typeof value.pinyin === 'string' ? value.pinyin : '' };
    }));
    entries.push(...batch);
  }
  return buildCharacterChoices(target, entries);
}
export async function readRecallContext(plugin: RNPlugin): Promise<RecallContext | null> {
  const widget = await plugin.widget.getWidgetContext<WidgetLocation.FlashcardUnder>();
  const card = await plugin.queue.getCurrentCard();
  if (!card || (card.type !== 'forward' && card.type !== 'backward') || card.remId !== widget.remId ||
      (widget.cardId !== undefined && card._id !== widget.cardId) || await plugin.queue.inLookbackMode()) return null;
  const rem = await plugin.rem.findOne(card.remId);
  if (!rem || !await rem.hasPowerup(RECALL_POWERUP)) return null;
  const stored = parseRecallSchema(await rem.getPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT));
  if (card.type === 'backward' && !stored.bidirectional) return null;
  const schema: RecallSchema = card.type === 'backward' ? { ...stored, skill: 'chinese-to-english' } : stored;
  const reviewAt = (card.repetitionHistory || []).reduce((at, r) => Math.max(at, r.date), 0);
  return { cardId: card._id, schema, reviewAt, direction: card.type as 'forward' | 'backward', revealed: widget.revealed || await plugin.queue.hasRevealedAnswer(),
    key: JSON.stringify([card._id, reviewAt, schema]) };
}
const authorLocks = new Map<string, Promise<unknown>>();
/** Registry reserves drafts before activation; retries reuse the same Rem and preserve native history. */
export function ensureRecallCard(plugin: RNPlugin, schema: RecallSchema, parentId: string): Promise<string> {
  parseRecallSchema(JSON.stringify(schema));
  const key = `hm:v3:card:${schema.vocabularyId}:${schema.skill}`;
  const run = async () => {
    const link = await plugin.storage.getSynced<{ id: string; complete: boolean }>(key);
    if (link && (typeof link.id !== 'string' || typeof link.complete !== 'boolean')) throw new Error('The saved study-card link is invalid; no card was changed.');
    let rem = link ? await plugin.rem.findOne(link.id) : undefined;
    let updating = false;
    if (rem && link?.complete) {
      if (!await rem.hasPowerup(RECALL_POWERUP)) throw new Error('The linked Rem is no longer a Hanzi study card; no card was changed.');
      const old = parseRecallSchema(await rem.getPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT));
      if (old.vocabularyId !== schema.vocabularyId || old.skill !== schema.skill) throw new Error('The linked study card belongs to a different vocabulary or skill.');
      if (old.bidirectional !== schema.bidirectional) throw new Error('Existing translation directions are preserved. Reuse the existing translation cards.');
      if (rem.parent !== parentId) await rem.setParent(parentId);
      if (JSON.stringify(old) === JSON.stringify(schema)) return rem._id;
      updating = true;
    }
    if (!rem) rem = await plugin.rem.createRem();
    if (!rem) throw new Error('Could not create the study card.');
    if (!updating) await rem.setPracticeDirection('none');
    if (!updating) await plugin.storage.setSynced(key, { id: rem._id, complete: false, bidirectional: !!schema.bidirectional });
    if (!updating) await rem.setParent(parentId);
    await rem.setText([recallFront(schema)]);
    await rem.setBackText([schema.bidirectional ? schema.traditional : `${schema.traditional} — ${schema.pinyin} — ${schema.meaning}`]);
    await rem.addPowerup(RECALL_POWERUP);
    await rem.setPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT, [JSON.stringify(schema)]);
    const confirmed = parseRecallSchema(await rem.getPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT));
    if (JSON.stringify(confirmed) !== JSON.stringify(schema)) throw new Error(updating ?
      'Study-card update was not confirmed. Keep the editor open and retry before reviewing this card.' :
      'Study-card metadata was not confirmed. The draft remains out of the review queue; retry.');
    if (!updating) await rem.setPracticeDirection(schema.bidirectional ? 'both' : 'forward');
    await plugin.storage.setSynced(key, { id: rem._id, complete: true, ...(schema.bidirectional ? { bidirectional: true } : {}) });
    return rem._id;
  };
  const pending = (authorLocks.get(key) || Promise.resolve()).catch(() => {}).then(run);
  authorLocks.set(key, pending);
  void pending.finally(() => { if (authorLocks.get(key) === pending) authorLocks.delete(key); }).catch(() => {});
  return pending;
}
/** Preserve legacy Rems and histories; use one bidirectional Rem for new translations. */
export async function ensureTranslationCards(plugin: RNPlugin, schema: Omit<RecallSchema, 'skill'>): Promise<string[]> {
  const forward = await plugin.storage.getSynced<{ id: string; complete: boolean; bidirectional?: boolean }>(`hm:v3:card:${schema.vocabularyId}:english-to-chinese`);
  const reverse = await plugin.storage.getSynced<{ id: string }>(`hm:v3:card:${schema.vocabularyId}:chinese-to-english`);
  const existing = forward && await plugin.rem.findOne(forward.id);
  const both = forward?.bidirectional || (forward?.complete && existing && await existing.hasPowerup(RECALL_POWERUP) && parseRecallSchema(await existing.getPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT)).bidirectional);
  if (both || (!forward && !reverse)) return [await ensureRecallCard(plugin, { ...schema, skill: 'english-to-chinese', bidirectional: true }, schema.vocabularyId)];
  const ids: string[] = [];
  for (const skill of ['english-to-chinese', 'chinese-to-english'] as const) ids.push(await ensureRecallCard(plugin, { ...schema, skill }, schema.vocabularyId));
  return ids;
}
export interface SkillRecord { id: string; at: number; cardId: string; result: RecallResult }
export interface SkillHistory { version: 1; attempts: number; passed: number; history: SkillRecord[] }
export const skillHistoryKey = (schema: RecallSchema) => `hm:v3:results:${schema.vocabularyId}:${schema.skill}:${encodeURIComponent(recallTargetKey(schema))}`;
const saveLocks = new Map<string, Promise<unknown>>();
export class SkillRepository {
  constructor(readonly storage: SyncedStore) {}
  async load(schema: RecallSchema): Promise<SkillHistory> {
    const value = await this.storage.getSynced<SkillHistory>(skillHistoryKey(schema));
    if (value === undefined || value === null) return { version: 1, attempts: 0, passed: 0, history: [] };
    if (value.version !== 1 || !Number.isInteger(value.attempts) || value.attempts < 0 || !Number.isInteger(value.passed) ||
        value.passed < 0 || value.passed > value.attempts || !Array.isArray(value.history) ||
        !value.history.every(r => typeof r.id === 'string' && Number.isFinite(r.at) && typeof r.result?.passed === 'boolean')) {
      throw new Error('Saved skill results are invalid; they have not been reset.');
    }
    return value;
  }
  save(schema: RecallSchema, record: SkillRecord): Promise<SkillHistory> {
    const key = skillHistoryKey(schema);
    const run = async () => {
      if (!record.id || !Number.isFinite(record.at)) throw new Error('Invalid study result.');
      const old = await this.load(schema);
      if (old.history.some(r => r.id === record.id)) return old;
      const next: SkillHistory = { version: 1, attempts: old.attempts + 1, passed: old.passed + Number(record.result.passed),
        history: [...old.history, record].slice(-200) };
      await this.storage.setSynced(key, next);
      const confirmed = await this.load(schema);
      if (!confirmed.history.some(r => r.id === record.id)) throw new Error('Skill-result save was not confirmed. Keep this result open and retry.');
      return confirmed;
    };
    const pending = (saveLocks.get(key) || Promise.resolve()).catch(() => {}).then(run);
    saveLocks.set(key, pending);
    void pending.finally(() => { if (saveLocks.get(key) === pending) saveLocks.delete(key); }).catch(() => {});
    return pending;
  }
}
