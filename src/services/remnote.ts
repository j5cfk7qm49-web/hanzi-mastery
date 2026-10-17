import { AppEvents, WidgetLocation, type RNPlugin } from '@remnote/plugin-sdk';
import { WRITING_POWERUP, SCHEMA_SLOT, parseWritingSchema, selectScript, characters, type WritingSchema } from '../core/schema';
import type { Settings } from '../core/config';
import type { ExerciseContext } from '../ui/ReviewExercise';
export interface ReviewContext extends ExerciseContext { key: string; revealed: boolean }
export async function readReviewContext(plugin: RNPlugin, settings: Settings): Promise<ReviewContext | null> {
  const widget = await plugin.widget.getWidgetContext<WidgetLocation.FlashcardUnder>();
  const card = await plugin.queue.getCurrentCard();
  if (!card || card.type !== 'forward' || widget.cardId !== card._id || widget.remId !== card.remId) return null;
  const rem = await card.getRem();
  if (!rem || !await rem.hasPowerup(WRITING_POWERUP)) return null;
  const schema = parseWritingSchema(await rem.getPowerupProperty(WRITING_POWERUP, SCHEMA_SLOT));
  const target = selectScript(schema, settings.script);
  if (await plugin.queue.inLookbackMode()) return null;
  return { cardId: card._id, vocabularyId: schema.vocabularyId, chars: characters(target), prompt: schema.prompt,
    key: `${card._id}:${card.lastRepetitionTime || 0}:${target}:${JSON.stringify(settings)}`,
    revealed: widget.revealed || await plugin.queue.hasRevealedAnswer() };
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
export async function createWritingCard(plugin: RNPlugin, schema: WritingSchema, parentId?: string): Promise<string> {
  parseWritingSchema(JSON.stringify(schema));
  let id = '';
  await plugin.app.transaction(async () => {
    const rem = await plugin.rem.createRem();
    if (!rem) throw new Error('RemNote could not create the writing card.');
    id = rem._id;
    if (parentId) await rem.setParent(parentId);
    await rem.setText([`Write in ${schema.simplified ? 'Chinese' : 'Traditional Chinese'}: ${schema.prompt}`]);
    await rem.setBackText([schema.traditional + (schema.simplified ? ' / ' + schema.simplified : '')]);
    await rem.setPracticeDirection('forward');
    await rem.addPowerup(WRITING_POWERUP);
    await rem.setPowerupProperty(WRITING_POWERUP, SCHEMA_SLOT, [JSON.stringify(schema)]);
  });
  return id;
}
