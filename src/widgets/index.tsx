import { declareIndexPlugin, WidgetLocation, PropertyType, type ReactRNPlugin } from '@remnote/plugin-sdk';
import { WRITING_POWERUP, VOCAB_POWERUP, SCHEMA_SLOT } from '../core/schema';
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
  await plugin.app.registerCommand({ id: 'hanzi-workbench', name: 'Hanzi Mastery: create writing card / practice / settings',
    description: 'Create a vocabulary entry and a safe writing prompt, or link to the focused vocabulary.',
    action: async () => {
      const rem = await plugin.focus.getFocusedRem();
      await plugin.widget.openPopup('workbench', { sourceRemId: rem?._id });
    } });
}
declareIndexPlugin(onActivate, async () => {});
