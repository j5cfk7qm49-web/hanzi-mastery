import type { RNPlugin } from '@remnote/plugin-sdk';
import { SCHEMA_SLOT, WRITING_POWERUP, parseWritingSchema, type Vocabulary, type WritingSchema } from '../core/schema';
import { RECALL_POWERUP, recallFront, recallTargetKey, parseRecallSchema, type RecallSchema } from '../core/recall';
import { defaultWritingPrompt, STUDY_NAMES, type StudySkill } from '../core/study';
import { createWritingCard } from './remnote';
import { ensureRecallCard, ensureTranslationCards, vocabularyCharacterChoices } from './recall';
import { serializeByKey } from './serial';
import { buildCharacterChoices } from '../core/characterChoices';

export type Direction = 'none' | 'forward' | 'backward' | 'both';
export interface LinkedStudyCard {
  id: string; schema: WritingSchema | RecallSchema; direction: Direction;
  front: string; back: string; nativeAnswerChanged: boolean; outsideWord: boolean;
}
export interface CardEdit { prompt?: string; reversePrompt?: string; audio?: string; direction?: Direction; restoreAnswer?: boolean }
export const writingFront = (schema: WritingSchema) => `Write in ${schema.simplified ? 'Chinese' : 'Traditional Chinese'}: ${schema.prompt}`;
export const writingBack = (schema: WritingSchema) => schema.traditional + (schema.simplified ? ' / ' + schema.simplified : '');
export const recallBack = (schema: RecallSchema) => schema.bidirectional ? schema.traditional : `${schema.traditional} — ${schema.pinyin} — ${schema.meaning}`;

export async function readStudyCards(plugin: RNPlugin, vocabularyId: string): Promise<LinkedStudyCard[]> {
  const result: LinkedStudyCard[] = [];
  for (const code of [WRITING_POWERUP, RECALL_POWERUP]) {
    const ref = await plugin.powerup.getPowerupByCode(code), powerup = ref && await plugin.rem.findOne(ref._id);
    if (!powerup) continue;
    for (const tagged of await powerup.taggedRem()) {
      const rem = await plugin.rem.findOne(tagged._id);
      if (!rem) continue;
      const raw = await rem.getPowerupProperty(code, SCHEMA_SLOT);
      let value: { vocabularyId?: string };
      try { value = JSON.parse(raw); } catch { continue; }
      if (value?.vocabularyId !== vocabularyId) continue;
      const schema = code === WRITING_POWERUP ? parseWritingSchema(raw) : parseRecallSchema(raw);
      const front = await plugin.richText.toString(rem.text || []), back = await plugin.richText.toString(rem.backText || []);
      const expected = schema.skill === 'writing' ? writingBack(schema) : recallBack(schema);
      result.push({ id: rem._id, schema, direction: await rem.getPracticeDirection(), front, back,
        outsideWord: rem.parent !== vocabularyId,
        nativeAnswerChanged: back !== expected || (schema.skill !== 'writing' && schema.bidirectional === true && front !== schema.meaning) });
    }
  }
  return result;
}

export function ensureWritingCard(plugin: RNPlugin, schema: WritingSchema, newEntry = false): Promise<string> {
  const key = `hm:v6:card:${schema.vocabularyId}:writing`;
  return serializeByKey(plugin.storage, key, async () => {
    const link = await plugin.storage.getSynced<{ id: string; complete: boolean }>(key);
    if (link?.complete) {
      const rem = await plugin.rem.findOne(link.id);
      if (rem) {
        const old = parseWritingSchema(await rem.getPowerupProperty(WRITING_POWERUP, SCHEMA_SLOT));
        if (old.vocabularyId !== schema.vocabularyId) throw new Error('The writing-card link belongs to another entry.');
        return rem._id;
      }
    }
    // A just-created vocabulary entry cannot have legacy cards. Existing entries
    // still inventory them before reserving a new writing card.
    if (!link && !newEntry) {
      const existing = (await readStudyCards(plugin, schema.vocabularyId)).find(card => card.schema.skill === 'writing');
      if (existing) { await plugin.storage.setSynced(key, { id: existing.id, complete: true }); return existing.id; }
    }
    let draftId = link?.id;
    if (!draftId || !await plugin.rem.findOne(draftId)) {
      const draft = await plugin.rem.createRem();
      if (!draft) throw new Error('Could not create the writing card.');
      draftId = draft._id;
      await plugin.storage.setSynced(key, { id: draftId, complete: false });
    }
    const id = await createWritingCard(plugin, schema, { parentId: schema.vocabularyId, resumeId: draftId });
    await plugin.storage.setSynced(key, { id, complete: true });
    return id;
  });
}

/** Each requested skill is attempted. Existing validation is unchanged; failures stay visible and retryable. */
export async function ensureStudyCards(plugin: RNPlugin, id: string, word: Vocabulary, skills: readonly StudySkill[], options: {
  newEntry?: boolean; vocabulary?: readonly Vocabulary[];
} = {}): Promise<string[]> {
  const errors: string[] = [];
  const base = { version: 1 as const, vocabularyId: id, traditional: word.traditional, pinyin: word.pinyin,
    meaning: word.meanings.join('; '), ...(word.audio?.[0] ? { referenceAudio: word.audio[0] } : {}), ...(word.audioSource ? { audioSource: word.audioSource } : {}) };
  let translationsDone = false;
  for (const skill of skills) {
    try {
      if (skill === 'writing') {
        await ensureWritingCard(plugin, { version: 2, skill, vocabularyId: id, traditional: word.traditional,
          ...(word.simplified ? { simplified: word.simplified } : {}), prompt: defaultWritingPrompt(word) }, options.newEntry);
      } else if ((skill === 'english-to-chinese' || skill === 'chinese-to-english') && skills.includes('english-to-chinese') && skills.includes('chinese-to-english')) {
        if (!translationsDone) {
          const forward = await plugin.storage.getSynced<{ id: string; complete: boolean; bidirectional?: boolean }>(`hm:v3:card:${id}:english-to-chinese`);
          const reverse = await plugin.storage.getSynced<{ id: string; complete: boolean }>(`hm:v3:card:${id}:chinese-to-english`);
          if ((!forward && !reverse) || (forward?.bidirectional && !forward.complete)) await ensureTranslationCards(plugin, base);
          else {
            const forwardRem = forward?.complete && await plugin.rem.findOne(forward.id);
            const both = forwardRem && parseRecallSchema(await forwardRem.getPowerupProperty(RECALL_POWERUP, SCHEMA_SLOT)).bidirectional;
            if (!both) for (const direction of ['english-to-chinese', 'chinese-to-english'] as const) {
              const link = direction === 'english-to-chinese' ? forward : reverse;
              if (!link?.complete || !await plugin.rem.findOne(link.id)) await ensureRecallCard(plugin, { ...base, skill: direction }, id);
            }
          }
          translationsDone = true;
        }
      } else {
        const link = await plugin.storage.getSynced<{ id: string; complete: boolean }>(`hm:v3:card:${id}:${skill}`);
        // Reimports must not rewrite custom prompts/audio or reactivate existing cards.
        if (link?.complete && await plugin.rem.findOne(link.id)) continue;
        const choices = skill === 'character-choice' ? options.vocabulary ? buildCharacterChoices(word, [...options.vocabulary]) : await vocabularyCharacterChoices(plugin, word) : undefined;
        await ensureRecallCard(plugin, { ...base, skill, ...(choices ? { choices } : {}) }, id);
      }
    } catch (error) { errors.push(`${STUDY_NAMES[skill]}: ${error instanceof Error ? error.message : 'Could not save this card.'}`); }
  }
  return errors;
}

/** Construct the complete update before mutating any notes. Old schemas pin their existing history namespace. */
export async function planCardUpdates(plugin: RNPlugin, id: string, old: Vocabulary, next: Vocabulary, edits: Record<string, CardEdit>, resuming = false) {
  const cards = await readStudyCards(plugin, id);
  const updates: { card: LinkedStudyCard; schema: WritingSchema | RecallSchema; edit: CardEdit }[] = [];
  for (const card of cards) {
    const edit = edits[card.id] || {}, previous = card.schema;
    const checkAnswer = (schema: WritingSchema | RecallSchema) => {
      const front = schema.skill === 'writing' ? writingFront(schema) : recallFront(schema);
      const back = schema.skill === 'writing' ? writingBack(schema) : recallBack(schema);
      if (card.nativeAnswerChanged && !edit.restoreAnswer && !(resuming && card.front === front && card.back === back)) {
        throw new Error('A card answer was edited in RemNote. Inspect it in Cards and choose Restore word answer before saving shared changes.');
      }
    };
    if (previous.skill === 'writing') {
      const partialFront = resuming && card.front === writingFront({ ...previous, traditional: next.traditional, simplified: next.simplified, prompt: defaultWritingPrompt(next) });
      const nativeChanged = !partialFront && card.front !== writingFront(previous) && !!card.front;
      const nativePrompt = nativeChanged ? card.front.replace(/^Write in (?:Traditional Chinese|Chinese):\s*/, '') : previous.prompt;
      const custom = nativeChanged ? true : previous.customPrompt ?? nativePrompt !== defaultWritingPrompt(old);
      const prompt = edit.prompt !== undefined ? edit.prompt.trim() || defaultWritingPrompt(next) : custom ? nativePrompt : defaultWritingPrompt(next);
      const schema: WritingSchema = { ...previous, traditional: next.traditional, simplified: next.simplified,
        prompt, customPrompt: prompt !== defaultWritingPrompt(next) };
      parseWritingSchema(JSON.stringify(schema)); checkAnswer(schema); updates.push({ card, schema, edit });
    } else {
      const historyTarget = previous.historyTarget || recallTargetKey(previous);
      const partialFront = resuming && card.front === recallFront({ ...previous, traditional: next.traditional, pinyin: next.pinyin, meaning: next.meanings.join('; ') });
      const nativeCustom = !partialFront && !previous.bidirectional && card.front !== recallFront(previous) && card.front ? card.front : previous.customPrompt;
      const ownAudio = previous.customAudio ?? (!!previous.referenceAudio && previous.referenceAudio !== old.audio?.[0]);
      const schema: RecallSchema = { ...previous, traditional: next.traditional, pinyin: next.pinyin, meaning: next.meanings.join('; '), historyTarget,
        customPrompt: edit.prompt !== undefined ? edit.prompt.trim() || undefined : nativeCustom,
        reversePrompt: edit.reversePrompt !== undefined ? edit.reversePrompt.trim() || undefined : previous.reversePrompt,
        customAudio: edit.audio !== undefined ? !!edit.audio.trim() : ownAudio,
        referenceAudio: edit.audio !== undefined ? edit.audio.trim() || next.audio?.[0] : ownAudio ? previous.referenceAudio : next.audio?.[0] };
      schema.audioSource = schema.referenceAudio === next.audioSource?.url ? next.audioSource : undefined;
      if (schema.skill === 'character-choice' && (previous.traditional !== next.traditional || previous.pinyin !== next.pinyin)) schema.choices = await vocabularyCharacterChoices(plugin, next);
      parseRecallSchema(JSON.stringify(schema)); checkAnswer(schema); updates.push({ card, schema, edit });
    }
  }
  return updates;
}
export async function applyCardUpdates(plugin: RNPlugin, updates: Awaited<ReturnType<typeof planCardUpdates>>): Promise<number> {
  let completed = 0;
  for (const { card, schema, edit } of updates) {
    try {
      const rem = await plugin.rem.findOne(card.id);
      if (!rem) throw new Error('A linked card is unavailable.');
      const code = schema.skill === 'writing' ? WRITING_POWERUP : RECALL_POWERUP;
      await rem.setText([schema.skill === 'writing' ? writingFront(schema) : recallFront(schema)]);
      await rem.setBackText([schema.skill === 'writing' ? writingBack(schema) : recallBack(schema)]);
      await rem.setPowerupProperty(code, SCHEMA_SLOT, [JSON.stringify(schema)]);
      if (await rem.getPowerupProperty(code, SCHEMA_SLOT) !== JSON.stringify(schema)) throw new Error('Metadata was not confirmed.');
      const confirmed = await plugin.rem.findOne(card.id);
      if (!confirmed || await plugin.richText.toString(confirmed.text || []) !== (schema.skill === 'writing' ? writingFront(schema) : recallFront(schema)) ||
          await plugin.richText.toString(confirmed.backText || []) !== (schema.skill === 'writing' ? writingBack(schema) : recallBack(schema))) throw new Error('Card text was not confirmed.');
      if (edit.direction !== undefined && edit.direction !== card.direction) {
        await rem.setPracticeDirection(edit.direction);
        if (await rem.getPracticeDirection() !== edit.direction) throw new Error('Card direction was not confirmed.');
      }
      completed++;
    } catch { throw new Error(`Word saved. Updated ${completed} of ${updates.length} cards; some linked study cards still need updating. Keep this editor open and save again to finish.`); }
  }
  return completed;
}
