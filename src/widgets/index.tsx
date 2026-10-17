import { declareIndexPlugin, WidgetLocation, type ReactRNPlugin } from '@remnote/plugin-sdk';
async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerWidget('hanzi_review', WidgetLocation.FlashcardUnder, { dimensions: { width: '100%', height: 'auto' } });
}
declareIndexPlugin(onActivate, async () => {});
