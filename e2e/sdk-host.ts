import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

/** Use the compiled SDK and entrypoint. Only the RemNote host's RPC responses are simulated. */
export async function openSdkWidget(page: Page, widget: 'index' | 'hanzi_review' | 'recall_review') {
  const calls: { methodName: string; args: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('recordSdkCall', (call: typeof calls[number]) => calls.push(call));
  await page.route(/^https?:\/\/(hanzi-startup|hanzi-plugin)\.test\//, async route => {
    const name = new URL(route.request().url()).pathname;
    if (name === '/host') return route.fulfill({ contentType: 'text/html', body:
      `<!doctype html><html><body><p>Native card controls</p><button>Show Answer</button><iframe id="sdk-widget" title="SDK widget" src="https://hanzi-plugin.test/index.html?widgetName=${widget}&pluginId=hanzi_mastery_handwriting_v1" style="width:360px;height:700px"></iframe></body></html>` });
    if (name === '/App.css') return route.fulfill({ contentType: 'text/css', body: '' });
    try {
      const file = name.slice(1);
      if (!/^[\w./-]+$/.test(file) || file.includes('..')) throw new Error('Invalid fixture asset');
      return route.fulfill({ body: await readFile((process.env.HANZI_SDK_FIXTURE_DIR || 'dist') + '/' + file), contentType:
        file.endsWith('.html') ? 'text/html' : file.endsWith('.json') ? 'application/json' : 'text/javascript' });
    } catch { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
  await page.addInitScript(({ widget }) => {
    if (window !== window.parent) return;
    const saved = new Map<string, unknown>();
    // Wire-format data is converted to Card by the real SDK, not an adapter mock.
    const card = { _id: 'fixture-card', remId: 'fixture-rem', cardType: 'f', history: [] };
    const schema = widget === 'recall_review' ?
      { version: 1, skill: 'pinyin', vocabularyId: 'fixture-vocab', traditional: '人', pinyin: 'rén', meaning: 'person' } :
      { version: 2, skill: 'writing', vocabularyId: 'fixture-vocab', traditional: '人', prompt: 'person (rén)' };
    window.addEventListener('message', event => {
      const call = event.data;
      if (!call?.isIntendedForRemNoteAPIMain) return;
      void (window as unknown as { recordSdkCall(call: unknown): Promise<void> }).recordSdkCall(call);
      const source = event.source as Window;
      if (call.methodName === 'askToActivate') source.postMessage({ isIntendedForRemNoteAPIPlugin: true,
        eventId: 'onActivate', args: { inSandbox: true, widgetInstanceId: 'fixture-widget',
          rootURL: 'https://hanzi-plugin.test/', widgetOptions: { dimensions: { width: '100%', height: 'auto' } }, styleSheetHREFs: [] } }, '*');
      let response: unknown;
      if (call.methodName === 'queue.getCurrentCard') response = card;
      if (call.methodName === 'queue.inLookbackMode' || call.methodName === 'queue.hasRevealedAnswer') response = false;
      if (call.methodName === 'widget.getWidgetContext') response = { remId: card.remId, cardId: card._id, revealed: false };
      if (call.methodName === 'rem.findOne') response = { _id: card.remId };
      if (call.methodName === 'rem.hasPowerup') response = true;
      if (call.methodName === 'rem.getPowerupProperty') response = JSON.stringify(schema);
      if (call.methodName === 'storage.getSynced') response = saved.get(call.args.key);
      if (call.methodName === 'storage.setSynced') saved.set(call.args.key, call.args.value);
      source.postMessage({ isIntendedForRemNoteAPIPlugin: true, messageId: call.messageId, response }, '*');
    });
  }, { widget });
  await page.goto('http://hanzi-startup.test/host');
  const frame = page.frameLocator('#sdk-widget');
  // HTTPS assets can still lack secure-context APIs under a non-trustworthy app ancestor.
  // The browser itself removes randomUUID; the test does not stub the API or SDK.
  const loadedFrame = page.frames().find(child => child.url().startsWith('https://hanzi-plugin.test/'))!;
  const capabilities = await loadedFrame.evaluate(() => ({ secure: isSecureContext,
    randomUUID: typeof crypto.randomUUID, getRandomValues: typeof crypto.getRandomValues }));
  return { frame, capabilities, calls, errors };
}
