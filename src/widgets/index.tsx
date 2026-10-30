import { declareIndexPlugin, WidgetLocation, PropertyType, type ReactRNPlugin } from '@remnote/plugin-sdk';
import { WRITING_POWERUP, VOCAB_POWERUP, SCHEMA_SLOT } from '../core/schema';
import { RECALL_POWERUP } from '../core/recall';
import { REVIEW_HOST_CSS } from '../ui/reviewHostCss';
import { POPUP_HOST_CSS } from '../ui/popupHostCss';
import { bindNativeStudyReviews } from '../services/nativeStudyReviews';
import { auditNativeStudyCleanup } from '../studyPacks/cleanup';
async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerPowerup({ name: 'Hanzi Writing', code: WRITING_POWERUP,
    description: 'Independent Chinese writing cards. Create with the Hanzi Mastery workbench.',
    options: { slots: [{ code: SCHEMA_SLOT, name: 'Writing metadata', hidden: true, onlyProgrammaticModifying: true, propertyType: PropertyType.TEXT }] } });
  await plugin.app.registerPowerup({ name: 'Hanzi Vocabulary', code: VOCAB_POWERUP,
    description: 'Shared vocabulary entry for independently scheduled skill cards.',
    options: { slots: [{ code: SCHEMA_SLOT, name: 'Vocabulary metadata', hidden: true, onlyProgrammaticModifying: true, propertyType: PropertyType.TEXT }] } });
  await plugin.app.registerWidget('hanzi_review', WidgetLocation.FlashcardUnder, {
    powerupFilter: WRITING_POWERUP, dimensions: { width: '100%', height: 400 }
  });
  await plugin.app.registerWidget('workbench', WidgetLocation.Popup, { dimensions: { width: 'min(560px, 95vw)', height: 640 } });
  await plugin.app.registerWidget('study_packs', WidgetLocation.Popup, { dimensions: { width: 'min(560px, 95vw)', height: 640 } });
  await plugin.app.registerCommand({ id: 'hanzi-study-packs', name: 'Hanzi Mastery: Midterm / course study',
    description: 'Optional course activities and private imports with separate progress.',
    action: async () => { await plugin.widget.openPopup('study_packs', {}, false); } });
  await plugin.app.registerPowerup({ name: 'Hanzi Study', code: RECALL_POWERUP,
    description: 'Translation, pinyin, tone, character recognition, listening and spoken-practice cards with independent schedules.',
    options: { slots: [{ code: SCHEMA_SLOT, name: 'Study metadata', hidden: true, onlyProgrammaticModifying: true, propertyType: PropertyType.TEXT }] } });
  await plugin.app.registerWidget('recall_review', WidgetLocation.FlashcardUnder, {
    powerupFilter: RECALL_POWERUP, dimensions: { width: '100%', height: 'auto' }
  });
  await plugin.app.registerCommand({ id: 'hanzi-study-skills', name: 'Hanzi Mastery: import, edit and create study cards',
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
  await plugin.app.registerCSS('hanzi-review-fit', REVIEW_HOST_CSS);
  await plugin.app.registerCSS('hanzi-popup-fit', POPUP_HOST_CSS);
  // Commands remain available when a synced list has not finished downloading.
  try { await auditNativeStudyCleanup(plugin); } catch { console.warn('Hanzi Mastery: cleanup audit could not complete. No cards were deleted.'); }
  try { await bindNativeStudyReviews(plugin); } catch { console.warn('Hanzi Mastery: reopen the study list and Reload Rems to retry its queue connections.'); }
}
declareIndexPlugin(onActivate, async () => {});
