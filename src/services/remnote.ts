import { AppEvents, WidgetLocation, type RNPlugin } from '@remnote/plugin-sdk';
import { WRITING_POWERUP, SCHEMA_SLOT, parseWritingSchema, selectScript, characters, type WritingSchema } from '../core/schema';
import type { Settings } from '../core/config';
import type { ExerciseContext } from '../ui/ReviewExercise';
export interface ReviewContext extends ExerciseContext { key: string; revealed: boolean }
export async function readReviewContext(plugin: RNPlugin, settings: Settings): Promise<ReviewContext | null> {
  let phase = 'widget context';
  try {
    const widget = await plugin.widget.getWidgetContext<WidgetLocation.FlashcardUnder>();
    phase = 'current card';
    const card = await plugin.queue.getCurrentCard();
    if (!card || card.type !== 'forward' || widget.cardId !== card._id || widget.remId !== card.remId) return null;
    phase = 'card Rem';
    // SDK 0.0.46's Card.getRem returns unwrapped data at runtime despite its declared type.
    const rem = await plugin.rem.findOne(card.remId);
    phase = 'writing Powerup';
    if (!rem || !await rem.hasPowerup(WRITING_POWERUP)) return null;
    phase = 'writing metadata';
    const schema = parseWritingSchema(await rem.getPowerupProperty(WRITING_POWERUP, SCHEMA_SLOT));
    phase = 'script selection';
    const target = selectScript(schema, settings.script);
    phase = 'lookback state';
    if (await plugin.queue.inLookbackMode()) return null;
    phase = 'answer visibility';
    const lastReviewAt = (card.repetitionHistory || []).reduce((at, r) => Math.max(at, r.date), 0);
    return { cardId: card._id, vocabularyId: schema.vocabularyId, chars: characters(target), prompt: schema.prompt,
      key: `${card._id}:${lastReviewAt}:${target}:${JSON.stringify(settings)}`,
      revealed: widget.revealed || await plugin.queue.hasRevealedAnswer() };
  } catch { throw new Error(`Hanzi Mastery could not read ${phase}. Testing is blocked; check the card configuration or host API support.`); }
}
export async function stillCurrent(plugin: RNPlugin, cardId: string, allowRevealed = true): Promise<boolean> {
  const card = await plugin.queue.getCurrentCard();
  return card?._id === cardId && card.type === 'forward' && !await plugin.queue.inLookbackMode() && (allowRevealed || !await plugin.queue.hasRevealedAnswer());
}
export function subscribeReview(plugin: RNPlugin, refresh: () => void, reveal: (cardId?: string) => void): () => void {
  const key = `hm-${crypto.randomUUID()}`;
  const queue = [AppEvents.QueueLoadCard, AppEvents.QueueExit, AppEvents.QueueCompleteCard] as const;
  for (const event of queue) plugin.event.addListener(event, key, refresh);
  plugin.event.addListener(AppEvents.RevealAnswer, key, args => reveal(args?.cardId));
  return () => {
    for (const event of queue) plugin.event.removeListener(event, key, refresh);
    plugin.event.removeListener(AppEvents.RevealAnswer, key);
  };
}
export async function ensureCollection(plugin: RNPlugin): Promise<string> {
  const saved = await plugin.storage.getSynced<string>('hm:v2:collection');
  if (saved && await plugin.rem.findOne(saved)) return saved;
  const collection = await plugin.rem.createRem();
  if (!collection) throw new Error('Could not create the Hanzi Mastery document.');
  await collection.setText(['Hanzi Mastery']);
  await collection.setIsDocument(true);
  await plugin.storage.setSynced('hm:v2:collection', collection._id);
  return collection._id;
}
export async function createWritingCard(plugin: RNPlugin, schema: WritingSchema, options: {
  parentId?: string; resumeId?: string; onCreate?(id: string): void;
} = {}): Promise<string> {
  parseWritingSchema(JSON.stringify(schema));
  const rem = options.resumeId ? await plugin.rem.findOne(options.resumeId) : await plugin.rem.createRem();
  if (!rem) throw new Error('RemNote could not create or resume the writing card.');
  options.onCreate?.(rem._id);
  await rem.setPracticeDirection('none');
  if (options.parentId) await rem.setParent(options.parentId);
  await rem.setText([`Write in ${schema.simplified ? 'Chinese' : 'Traditional Chinese'}: ${schema.prompt}`]);
  await rem.setBackText([schema.traditional + (schema.simplified ? ' / ' + schema.simplified : '')]);
  await rem.addPowerup(WRITING_POWERUP);
  await rem.setPowerupProperty(WRITING_POWERUP, SCHEMA_SLOT, [JSON.stringify(schema)]);
  await rem.setPracticeDirection('forward');
  return rem._id;
}
