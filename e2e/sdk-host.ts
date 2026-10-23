import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

/** Use the compiled SDK and entrypoint. Only the RemNote host's RPC responses are simulated. */
export async function openSdkWidget(page: Page, widget: 'index' | 'hanzi_review' | 'recall_review' | 'workbench', options: { focusedVocabulary?: boolean; focusedRemId?:string; translationDirection?: 'forward' | 'backward' } = {}) {
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
  await page.addInitScript(({ widget, focusedVocabulary, focusedRemId, translationDirection }) => {
    if (window !== window.parent) return;
    const saved = new Map<string, unknown>();
    const vocabulary = [
      { _id: 'fixture-vocab', traditional: '型', pinyin: 'xíng', meanings: ['model'] },
      { _id: 'fixture-polyphone', traditional: '行', pinyin: 'háng', meanings: ['row'] },
      { _id: 'fixture-book', traditional: '書', pinyin: 'shū', meanings: ['book'] },
      { _id: 'fixture-love', traditional: '愛', pinyin: 'ài', meanings: ['love'] },
      { _id: 'fixture-country', traditional: '國', pinyin: 'guó', meanings: ['country'] },
    ];
    const metadata = new Map(vocabulary.map(entry => [entry._id, JSON.stringify({ version: 2, source: 'Test fixture', categories: [], ...entry })]));
    const parents=new Map<string,string|null>([['fixture-collection',null],['fixture-external',null], ...vocabulary.map(entry=>[entry._id,'fixture-collection'] as [string,string])]);
    const texts=new Map<string,string[]>([['fixture-collection',['Hanzi Mastery']],['fixture-external',['External lesson']],...vocabulary.map(entry=>[entry._id,[entry.traditional]] as [string,string[]])]);
    const tags=new Map(vocabulary.map(entry=>[entry._id,new Set(['hanzi-vocabulary-v2'])]));
    const wire=(id:string)=>parents.has(id)?{_id:id,parent:parents.get(id),text:texts.get(id)||[]}:undefined;
    (window as unknown as { changeNativeRem(id:string,parent:string,text?:string):void }).changeNativeRem=(id,parent,text)=>{
      parents.set(id,parent); if(text!==undefined) texts.set(id,[text]);
    };
    let createdRems = 0;
    if (widget === 'workbench') saved.set('hm:v2:collection', 'fixture-collection');
    // Wire-format data is converted to Card by the real SDK, not an adapter mock.
    const card = { _id: 'fixture-card', remId: 'fixture-rem', cardType: translationDirection === 'backward' ? 'b' : 'f', history: [] };
    const schema = widget === 'recall_review' ?
      { version: 1, skill: translationDirection ? 'english-to-chinese' : 'pinyin', ...(translationDirection ? {bidirectional:true} : {}), vocabularyId: 'fixture-vocab', traditional: '人', pinyin: 'rén', meaning: 'person' } :
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
      if (call.methodName === 'widget.getWidgetContext') response = { remId: card.remId, cardId: card._id, revealed: false,
        ...(widget === 'workbench' && (focusedRemId || focusedVocabulary) ? { contextData: { sourceRemId: focusedRemId || 'fixture-vocab' } } : {}) };
      if (call.methodName === 'rem.findOne') response = widget === 'workbench' ? wire(call.args.remId) : { _id: card.remId };
      if (call.methodName === 'rem.hasPowerup') response = widget === 'workbench' ? tags.get(call.args.remId)?.has(call.args.powerupCode) || false : true;
      if (call.methodName === 'rem.addPowerup') {
        if(!tags.has(call.args.remId)) tags.set(call.args.remId,new Set()); tags.get(call.args.remId)!.add(call.args.powerupCode);
      }
      if (call.methodName === 'rem.setParent') parents.set(call.args.remId,call.args.parentId);
      if (call.methodName === 'rem.setText') texts.set(call.args.remId,call.args.text);
      if (call.methodName === 'rem.getParentRem') response=wire(parents.get(call.args.remId)!);
      if (call.methodName === 'rem.getChildrenRem') response=[...parents].filter(([,parent])=>parent===call.args.remId).map(([id])=>wire(id));
      if (call.methodName === 'richText.toString') response=call.args.richText.join('');
      if (call.methodName === 'rem.getPowerupProperty') response = widget === 'workbench' ? metadata.get(call.args.remId) : JSON.stringify(schema);
      if (call.methodName === 'rem.setPowerupProperty' && widget === 'workbench') metadata.set(call.args.remId, call.args.value[0]);
      if (call.methodName === 'powerup.getPowerupByCode') {
        const id=`powerup:${call.args.powerupCode}`; parents.set(id,null); response=wire(id);
      }
      if (call.methodName === 'rem.taggedRem') response = [...tags].filter(([,codes])=>codes.has(call.args.remId.slice('powerup:'.length))).map(([id])=>wire(id));
      if (call.methodName === 'rem.createRem') {
        const id=`fixture-created-${++createdRems}`; parents.set(id,null); response=wire(id);
      }
      if (call.methodName === 'storage.getSynced') response = saved.get(call.args.key);
      if (call.methodName === 'storage.setSynced') saved.set(call.args.key, call.args.value);
      source.postMessage({ isIntendedForRemNoteAPIPlugin: true, messageId: call.messageId, response }, '*');
    });
  }, { widget, focusedVocabulary: options.focusedVocabulary !== false, focusedRemId:options.focusedRemId, translationDirection:options.translationDirection });
  await page.goto('http://hanzi-startup.test/host');
  const frame = page.frameLocator('#sdk-widget');
  // HTTPS assets can still lack secure-context APIs under a non-trustworthy app ancestor.
  // The browser itself removes randomUUID; the test does not stub the API or SDK.
  const loadedFrame = page.frames().find(child => child.url().startsWith('https://hanzi-plugin.test/'))!;
  const capabilities = await loadedFrame.evaluate(() => ({ secure: isSecureContext,
    randomUUID: typeof crypto.randomUUID, getRandomValues: typeof crypto.getRandomValues }));
  return { frame, capabilities, calls, errors };
}
