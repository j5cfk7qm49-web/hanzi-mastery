import { WidgetLocation, type RNPlugin } from '@remnote/plugin-sdk';
import { SCHEMA_SLOT } from '../core/schema';
import { RECALL_POWERUP, parseRecallSchema, recallFront, recallTargetKey, type RecallSchema, type RecallResult, type RecallSkill } from '../core/recall';
import type { SyncedStore } from './persistence';

export interface RecallContext { cardId: string; schema: RecallSchema; revealed: boolean; reviewAt: number; key: string }
export async function readRecallContext(plugin: RNPlugin): Promise<RecallContext | null> {
  const widget = await plugin.widget.getWidgetContext<WidgetLocation.FlashcardUnder>();
  const card = await plugin.queue.getCurrentCard();
  if (!card || card.type !== 'forward' || card._id !== widget.cardId || card.remId !== widget.remId || await plugin.queue.inLookbackMode()) return null;
  const rem = await plugin.rem.findOne(card.remId);
  if (!rem || !await rem.hasPowerup(RECALL_POWERUP)) return null;
  const schema = parseRecallSchema(await rem.getPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT));
  const reviewAt = (card.repetitionHistory || []).reduce((at, r) => Math.max(at, r.date), 0);
  return { cardId: card._id, schema, reviewAt, revealed: widget.revealed || await plugin.queue.hasRevealedAnswer(),
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
    if (rem && link?.complete) {
      if (!await rem.hasPowerup(RECALL_POWERUP)) throw new Error('The linked Rem is no longer a Hanzi study card; no card was changed.');
      const old = parseRecallSchema(await rem.getPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT));
      if (old.vocabularyId !== schema.vocabularyId || old.skill !== schema.skill) throw new Error('The linked study card belongs to a different vocabulary or skill.');
      if (JSON.stringify(old) === JSON.stringify(schema)) return rem._id;
    }
    if (!rem) rem = await plugin.rem.createRem();
    if (!rem) throw new Error('Could not create the study card.');
    await rem.setPracticeDirection('none');
    await plugin.storage.setSynced(key, { id: rem._id, complete: false });
    await rem.setParent(parentId);
    await rem.setText([recallFront(schema)]);
    await rem.setBackText([`${schema.traditional} — ${schema.pinyin} — ${schema.meaning}`]);
    await rem.addPowerup(RECALL_POWERUP);
    await rem.setPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT, [JSON.stringify(schema)]);
    const confirmed = parseRecallSchema(await rem.getPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT));
    if (JSON.stringify(confirmed) !== JSON.stringify(schema)) throw new Error('Study-card metadata was not confirmed. The draft remains out of the review queue; retry.');
    await rem.setPracticeDirection('forward');
    await plugin.storage.setSynced(key, { id: rem._id, complete: true });
    return rem._id;
  };
  const pending = (authorLocks.get(key) || Promise.resolve()).catch(() => {}).then(run);
  authorLocks.set(key, pending);
  void pending.finally(() => { if (authorLocks.get(key) === pending) authorLocks.delete(key); }).catch(() => {});
  return pending;
}
export interface SkillRecord { id: string; at: number; cardId: string; result: RecallResult }
export interface SkillHistory { version: 1; attempts: number; passed: number; history: SkillRecord[] }
export const skillHistoryKey = (schema: RecallSchema) => `hm:v3:results:${schema.vocabularyId}:${schema.skill}:${encodeURIComponent(recallTargetKey(schema))}`;
const saveLocks = new Map<string, Promise<unknown>>();
export class SkillRepository {
  constructor(private storage: SyncedStore) {}
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
