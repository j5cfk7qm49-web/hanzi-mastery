import { declareIndexPlugin, WidgetLocation, PropertyType, type ReactRNPlugin } from '@remnote/plugin-sdk';
import { WRITING_POWERUP, VOCAB_POWERUP, SCHEMA_SLOT } from '../core/schema';
import { RECALL_POWERUP } from '../core/recall';
async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerPowerup({ name: 'Hanzi Writing', code: WRITING_POWERUP,
    description: 'Independent Chinese writing cards. Create with the Hanzi Mastery workbench.',
    options: { slots: [{ code: SCHEMA_SLOT, name: 'Writing metadata', hidden: true, onlyProgrammaticModifying: true, propertyType: PropertyType.TEXT }] } });
  await plugin.app.registerPowerup({ name: 'Hanzi Vocabulary', code: VOCAB_POWERUP,
    description: 'Shared vocabulary entry for independently scheduled skill cards.',
    options: { slots: [{ code: SCHEMA_SLOT, name: 'Vocabulary metadata', hidden: true, onlyProgrammaticModifying: true, propertyType: PropertyType.TEXT }] } });
  await plugin.app.registerWidget('hanzi_review', WidgetLocation.FlashcardUnder, {
    powerupFilter: WRITING_POWERUP, dimensions: { width: '100%', height: 'auto' }
  });
  await plugin.app.registerWidget('workbench', WidgetLocation.Popup, { dimensions: { width: 'min(560px, 95vw)', height: 'auto' } });
  await plugin.app.registerPowerup({ name: 'Hanzi Study', code: RECALL_POWERUP,
    description: 'Pinyin, tone, listening and spoken-practice cards with independent schedules.',
    options: { slots: [{ code: SCHEMA_SLOT, name: 'Study metadata', hidden: true, onlyProgrammaticModifying: true, propertyType: PropertyType.TEXT }] } });
  await plugin.app.registerWidget('recall_review', WidgetLocation.FlashcardUnder, {
    powerupFilter: RECALL_POWERUP, dimensions: { width: '100%', height: 'auto' }
  });
  await plugin.app.registerCommand({ id: 'hanzi-study-skills', name: 'Hanzi Mastery: pinyin, tones, listening and speaking',
    description: 'Focus a Hanzi Vocabulary entry to create its independently scheduled study cards.',
    action: async () => {
      const rem = await plugin.focus.getFocusedRem();
      await plugin.widget.openPopup('workbench', { sourceRemId: rem?._id });
    } });
  await plugin.app.registerCommand({ id: 'hanzi-workbench', name: 'Hanzi Mastery: create writing card / practice / settings',
    description: 'Create a vocabulary entry and a safe writing prompt, or link to the focused vocabulary.',
    action: async () => {
      const rem = await plugin.focus.getFocusedRem();
      await plugin.widget.openPopup('workbench', { sourceRemId: rem?._id });
    } });
}
declareIndexPlugin(onActivate, async () => {});
