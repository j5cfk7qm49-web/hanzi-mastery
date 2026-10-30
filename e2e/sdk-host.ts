import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { REVIEW_HOST_CSS } from '../src/ui/reviewHostCss';
import { POPUP_HOST_CSS } from '../src/ui/popupHostCss';
import { nativeFront,nativeBack,exerciseConfig,listMetadata } from '../src/studyPacks/nativeRems';
import type {StudyPack} from '../src/studyPacks/model';
import type {StudyItem} from '../src/studyPacks/model';
import {nativeReviewSchema} from '../src/services/nativeStudyReviews';

/** Use the compiled SDK and entrypoint. Only the RemNote host's RPC responses are simulated. */
export async function openSdkWidget(page: Page, widget: 'index' | 'hanzi_review' | 'recall_review' | 'workbench' | 'study_packs', options: { focusedVocabulary?: boolean; focusedRemId?:string; translationDirection?: 'forward' | 'backward'; secureHost?:boolean; nativeStudy?:boolean; nativeQueueSkill?:'writing'|'pinyin'|'listening'; nativeQueueItem?:StudyItem; nativeQueueAudioAvailable?:boolean; nativeQueueAudioUrl?:string; nativeMode?:boolean; nativeOral?:boolean; sandboxedFrame?:boolean; iframeSandbox?:string; iframeAllow?:string; hostMicrophonePolicy?:string; queueStyle?:'compact'|'beautiful'; popupLayout?:boolean; coursePack?:StudyPack; pausedStudyCards?:boolean; emptyCardLookupOnce?:boolean } = {}) {
  const calls: { methodName: string; args: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('recordSdkCall', (call: typeof calls[number]) => calls.push(call));
  await page.route(/^https?:\/\/(hanzi-startup|hanzi-plugin)\.test\//, async route => {
    const name = new URL(route.request().url()).pathname;
    if (name === '/host' && options.nativeMode) {
      const beautiful=options.queueStyle==='beautiful';
      const content='<div class="hm-layout-native-content"><p>Native question outside the plugin</p><div class="fade-in-first-load"><div id="native-mount" data-plugin-id="hanzi_mastery_handwriting_v1"></div></div></div>';
      const controls='<footer class="hm-layout-native" aria-label="Native card controls"><button>Show Answer</button></footer>';
      return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/native-layout.css"></head><body style="font-family:monospace;overflow:auto;margin:0"><div id="host-sentinel" style="position:absolute;left:-10000px">Unrelated host content</div><div class="hm-layout-host rn-queue${beautiful?' queue-beautiful-box hm-layout-beautiful':''}"><header class="hm-layout-toolbar">Native SDK fixture</header><div class="hm-layout-card"><div class="hm-layout-repetition spacedRepetition"><main class="hm-layout-scroll width-container-scroller"><div class="rn-queue__content">${beautiful?'<div class="beautiful-queue-insight-scroll-layout"><div class="beautiful-queue-card-scroll-stage"><div class="beautiful-queue-card-content">'+content+'</div></div><div class="beautiful-queue-card-free-space"></div></div>':content}</div></main>${beautiful?'<div class="beautiful-queue-bottom-controls-overlay">'+controls+'</div>':''}</div></div>${beautiful?'':controls}</div><script type="module">await import('https://hanzi-plugin.test/${widget}.js?widgetName=${widget}&pluginId=hanzi_mastery_handwriting_v1');window.nativePluginInstance=window.nativePluginRenderers.get('hanzi_mastery_handwriting_v1.${widget}')(false);</script></body></html>`});
    }
    if(name==='/native-layout.css')return route.fulfill({contentType:'text/css',body:(await readFile('e2e/layout-host.css','utf8'))+'\n'+REVIEW_HOST_CSS});
    if (name === '/host' && options.popupLayout) return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${POPUP_HOST_CSS} body{margin:0;overflow:hidden}dialog{display:block;border:0;padding:0;overflow:hidden;top:5vh;width:min(560px,95vw);max-height:90vh}iframe{display:block;width:100%;border:0;height:640px}</style></head><body><dialog open><iframe id="sdk-widget" data-plugin-id="hanzi_mastery_handwriting_v1" title="SDK widget" src="https://hanzi-plugin.test/index.html?widgetName=${widget}&pluginId=hanzi_mastery_handwriting_v1"></iframe></dialog></body></html>`});
    if (name === '/host') {
      const sandbox=options.iframeSandbox ?? (options.sandboxedFrame?'allow-scripts allow-forms allow-popups allow-modals allow-downloads':undefined);
      return route.fulfill({contentType:'text/html',headers:options.hostMicrophonePolicy?{'Permissions-Policy':`microphone=${options.hostMicrophonePolicy}`}:{},body:
        `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><p>Native card controls</p><button>Show Answer</button><iframe id="sdk-widget" title="SDK widget" ${sandbox===undefined?'':`sandbox="${sandbox}"`} ${options.iframeAllow===undefined?'':`allow="${options.iframeAllow}"`} src="https://hanzi-plugin.test/index.html?widgetName=${widget}&pluginId=hanzi_mastery_handwriting_v1" style="width:360px;height:700px"></iframe></body></html>`});
    }
    if (name === '/App.css') return route.fulfill({ contentType: 'text/css', body: '' });
    if(name==='/fixture.wav'){
      // A one-second PCM fixture tests real browser media completion; it is not instructor audio.
      const wav=Buffer.alloc(44+16000);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
      return route.fulfill({contentType:'audio/wav',headers:{'Access-Control-Allow-Origin':'*'},body:wav});
    }
    try {
      const file = name.slice(1);
      if (!/^[\w./-]+$/.test(file) || file.includes('..')) throw new Error('Invalid fixture asset');
      return route.fulfill({ body: await readFile((process.env.HANZI_SDK_FIXTURE_DIR || 'dist') + '/' + file),headers:{'Access-Control-Allow-Origin':'*'}, contentType:
        file.endsWith('.html') ? 'text/html' : file.endsWith('.json') ? 'application/json' : 'text/javascript' });
    } catch { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
  const courseAudio=options.coursePack?.audio.map(a=>({...a,remId:a.remId||'audio:'+a.id}));
  const courseSeed=options.coursePack && {metadata:listMetadata({...options.coursePack,audio:courseAudio!}),audio:courseAudio!,items:options.coursePack.items.map(item=>({id:item.id,front:nativeFront(item),back:nativeBack(item),config:'Hanzi Mastery exercise: '+JSON.stringify(exerciseConfig(item))}))};
  const nativeQueueItem=options.nativeQueueItem;
  const nativeQueueOverride=nativeQueueItem && {front:nativeFront(nativeQueueItem),back:nativeBack(nativeQueueItem),config:'Hanzi Mastery exercise: '+JSON.stringify(exerciseConfig(nativeQueueItem)),
    schema:nativeReviewSchema(nativeQueueItem,{configRemId:'native-review-config',studyPackId:'fixture-course',itemId:nativeQueueItem.id,...(nativeQueueItem.audioId?{audioRemId:'native-audio'}:{})})};
  await page.addInitScript(({ widget, focusedVocabulary, focusedRemId, translationDirection, nativeStudy, nativeQueueSkill, nativeQueueAudioAvailable, nativeQueueAudioUrl, nativeMode, nativeOral,courseSeed,pausedStudyCards,emptyCardLookupOnce,nativeQueueOverride }) => {
    if (window !== window.parent) return;
    type NativeFixtureWindow=Window & {nativePluginRenderers:Map<string,(hmr:boolean)=>unknown>;activeWidgetIds:Set<string>;widgetIdToWidget:Record<string,unknown>;nativePluginInstance:{receiveActivateMessage(args:unknown):Promise<void>}};
    if(nativeMode){const host=window as unknown as NativeFixtureWindow;host.nativePluginRenderers=new Map();host.activeWidgetIds=new Set(['fixture-widget']);host.widgetIdToWidget={};}
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
    const backs=new Map<string,string[]>(), directions=new Map<string,string>(),enabledCards=new Map<string,boolean>();
    const cardHistories=new Map<string,{date:number;score:number}[]>();let cardScans=0;
    const wireCard=(id:string)=>({_id:'card:'+id,owner:'fixture-kb',remId:id,cardType:'f',createdAt:1,history:cardHistories.get(id)||[],nextTime:(cardHistories.get(id)?.length||0)>0?Date.now()+86400000:1});
    if(nativeStudy){
      saved.set('hanzi-mastery-native-study-list-v1','native-list');
      parents.set('native-list',null);texts.set('native-list',['Editable native study list']);
      parents.set('native-item','native-list');texts.set('native-item',['Recall the test word.']);backs.set('native-item',['alpha Explanation: First model.']);
      parents.set('native-config','native-item');texts.set('native-config',['Hanzi Mastery exercise: '+JSON.stringify({id:'editable-item',section:1,mode:'custom-recall',kind:'text',source:'Authored test fixture'})]);
      if(nativeOral){texts.set('native-item',['Read aloud with Pinyin.']);backs.set('native-item',['rén Explanation: Self-assess the spoken reading.']);texts.set('native-config',['Hanzi Mastery exercise: '+JSON.stringify({id:'editable-item',section:1,mode:'reading',kind:'oral',glyph:'人',syllables:['rén'],source:'Authored oral fixture'})]);}
      parents.set('native-settings','native-list');texts.set('native-settings',['Hanzi Mastery list: '+JSON.stringify({schemaVersion:1,studyPackId:'editable-fixture',sections:[{id:1,title:'Test lesson'}],audio:[],notes:[],audioVersion:'one'})]);
      (window as unknown as {editNativeStudyAnswer(value:string):void}).editNativeStudyAnswer=value=>backs.set('native-item',[value]);
    }
    if(courseSeed){
      saved.set('hanzi-mastery-native-study-list-v1','native-list');parents.set('native-list',null);texts.set('native-list',['Fixture course']);
      parents.set('native-settings','native-list');texts.set('native-settings',[courseSeed.metadata]);
      for(const item of courseSeed.items){parents.set(item.id,'native-list');texts.set(item.id,[item.front]);backs.set(item.id,[item.back]);directions.set(item.id,'forward');parents.set('config:'+item.id,item.id);texts.set('config:'+item.id,[item.config]);cardHistories.set(item.id,[{date:1,score:0.5}]);}
      for(const asset of courseSeed.audio){parents.set(asset.remId,'native-list');texts.set(asset.remId,[{i:'a',url:asset.url}] as any);}
    }
    const wire=(id:string)=>parents.has(id)?{_id:id,parent:parents.get(id),text:texts.get(id)||[],backText:backs.get(id)||[]}:undefined;
    (window as unknown as { changeNativeRem(id:string,parent:string,text?:string):void }).changeNativeRem=(id,parent,text)=>{
      parents.set(id,parent); if(text!==undefined) texts.set(id,[text]);
    };
    let createdRems = 0;
    if (widget === 'workbench') saved.set('hm:v2:collection', 'fixture-collection');
    // Wire-format data is converted to Card by the real SDK, not an adapter mock.
    const card = { _id: 'fixture-card', remId: nativeQueueSkill ? 'native-review' : 'fixture-rem', cardType: translationDirection === 'backward' ? 'b' : 'f', history: [] };
    const schema = widget === 'recall_review' ?
      { version: 1, skill: translationDirection ? 'english-to-chinese' : 'pinyin', ...(translationDirection ? {bidirectional:true} : {}), vocabularyId: 'fixture-vocab', traditional: '人', pinyin: 'rén', meaning: 'person' } :
      { version: 2, skill: 'writing', vocabularyId: 'fixture-vocab', traditional: '人', prompt: 'person (rén)' };
    if(nativeQueueSkill){
      parents.set('native-review','native-list');parents.set('native-review-config','native-review');
      const writing=nativeQueueSkill==='writing';
      texts.set('native-review',[writing ? 'Write only the radical. [海]' : 'Recall the Pinyin. [木]']);
      backs.set('native-review',[writing ? '氵 Explanation: water component' : 'mù Explanation: tree']);
      texts.set('native-review-config',['Hanzi Mastery exercise: '+JSON.stringify({id:'queue-item',section:3,
        kind:writing ? 'writing' : 'text',mode:writing ? 'radical-writing' : 'radical-identity',glyph:writing ? '氵' : '木',
        ...(writing ? {referenceGlyph:'海'} : {}),source:'Authored fixture'})]);
      Object.assign(schema,{nativeStudy:{configRemId:'native-review-config',studyPackId:'fixture-course',itemId:'queue-item'}});
      if(nativeQueueSkill==='listening'){
        texts.set('native-review',['Listen, then type the vowel or final you heard.']);backs.set('native-review',['eng Explanation: Compare the supplied classroom sound.']);
        texts.set('native-review-config',['Hanzi Mastery exercise: '+JSON.stringify({id:'queue-item',section:2,kind:'text',mode:'dictation',source:'Authored sound fixture',...(nativeQueueAudioAvailable!==false?{audioId:'eng'}:{})})]);
        Object.assign(schema,{skill:'listening',traditional:'eng',pinyin:'eng',phoneticOnly:true,referenceRequired:true});
        if(nativeQueueAudioAvailable!==false){
          parents.set('native-audio','native-list');texts.set('native-audio',[{i:'a',url:nativeQueueAudioUrl || 'https://hanzi-plugin.test/fixture.wav'}] as any);
          Object.assign(schema,{nativeStudy:{configRemId:'native-review-config',studyPackId:'fixture-course',itemId:'queue-item',audioRemId:'native-audio'}});
        }
      }
      if(nativeQueueOverride){
        texts.set('native-review',[nativeQueueOverride.front]);backs.set('native-review',[nativeQueueOverride.back]);texts.set('native-review-config',[nativeQueueOverride.config]);
        Object.assign(schema,nativeQueueOverride.schema);
        if(nativeQueueAudioAvailable!==false){parents.set('native-audio','native-list');texts.set('native-audio',[{i:'a',url:nativeQueueAudioUrl || 'https://hanzi-plugin.test/fixture.wav'}] as any);}
      }
      (window as unknown as {editNativeStudyAnswer(value:string):void}).editNativeStudyAnswer=value=>backs.set('native-review',[value]);
    }
    window.addEventListener('message', event => {
      const call = event.data;
      if (!call?.isIntendedForRemNoteAPIMain) return;
      void (window as unknown as { recordSdkCall(call: unknown): Promise<void> }).recordSdkCall(call);
      const source = event.source as Window;
      if(!source)return; // A removed/reloaded fixture iframe can send its final SDK cleanup message.
      if (call.methodName === 'askToActivate') {
        const activation={inSandbox:!nativeMode,widgetInstanceId:'fixture-widget',rootURL:'https://hanzi-plugin.test/',widgetOptions:{dimensions:{width:'100%',height:'auto'}},styleSheetHREFs:[]};
        if(nativeMode)void (window as unknown as NativeFixtureWindow).nativePluginInstance.receiveActivateMessage({...activation,mountDiv:document.getElementById('native-mount')});
        else source.postMessage({isIntendedForRemNoteAPIPlugin:true,eventId:'onActivate',args:activation},'*');
      }
      let response: unknown;
      if (call.methodName === 'queue.getCurrentCard') response = card;
      if (call.methodName === 'queue.inLookbackMode' || call.methodName === 'queue.hasRevealedAnswer') response = false;
      if (call.methodName === 'widget.getWidgetContext') response = { remId: card.remId, cardId: card._id, revealed: false,
        ...(widget === 'workbench' && (focusedRemId || focusedVocabulary) ? { contextData: { sourceRemId: focusedRemId || 'fixture-vocab' } } : {}) };
      if (call.methodName === 'rem.findOne') response = widget === 'workbench' || widget === 'study_packs' || nativeQueueSkill ? wire(call.args.remId) : { _id: card.remId };
      if (call.methodName === 'rem.hasPowerup') response = widget === 'workbench' || widget === 'study_packs' ? tags.get(call.args.remId)?.has(call.args.powerupCode) || false : true;
      if (call.methodName === 'rem.addPowerup') {
        if(!tags.has(call.args.remId)) tags.set(call.args.remId,new Set()); tags.get(call.args.remId)!.add(call.args.powerupCode);
      }
      if (call.methodName === 'rem.setParent') parents.set(call.args.remId,call.args.parentId);
      if (call.methodName === 'rem.setText') texts.set(call.args.remId,call.args.text);
      if (call.methodName === 'rem.setBackText') backs.set(call.args.remId,call.args.backText);
      if (call.methodName === 'rem.setPracticeDirection') directions.set(call.args.remId,call.args.direction);
      if (call.methodName === 'rem.getPracticeDirection') response=directions.get(call.args.remId)||'forward';
      if (call.methodName === 'rem.getEnablePractice') response=enabledCards.get(call.args.remId) ?? !pausedStudyCards;
      if (call.methodName === 'rem.setEnablePractice') enabledCards.set(call.args.remId,call.args.enablePractice);
      if (call.methodName === 'rem.getCards') response=pausedStudyCards?[]:[wireCard(call.args.remId)];
      if (call.methodName === 'card.getAll') response=emptyCardLookupOnce && ++cardScans===1?[]:[...backs.keys()].map(wireCard);
      if (call.methodName === 'card.findOne') response=wireCard(String(call.args.id).replace(/^card:/,''));
      if (call.methodName === 'card.updateCardRepetitionStatus') {const id=String(call.args.id).replace(/^card:/,'');cardHistories.set(id,[...(cardHistories.get(id)||[]),{date:Date.now(),score:Number(call.args.score)}]);}
      if (call.methodName === 'rem.addTag') {
        if(!tags.has(call.args.remId)) tags.set(call.args.remId,new Set());
        tags.get(call.args.remId)!.add(call.args.tagId ?? call.args.tag);
      }
      if (call.methodName === 'rem.getTagRems') response=[...(tags.get(call.args.remId)||[])].map(id=>wire(id)||{_id:id});
      if (call.methodName === 'rem.getParentRem') response=wire(parents.get(call.args.remId)!);
      if (call.methodName === 'rem.getChildrenRem') response=[...parents].filter(([,parent])=>parent===call.args.remId).map(([id])=>wire(id));
      if (call.methodName === 'rem.getDescendants') response=[...parents].filter(([id])=>{let p=parents.get(id);while(p){if(p===call.args.remId)return true;p=parents.get(p);}return false;}).map(([id])=>wire(id));
      if (call.methodName === 'rem.findByName') response=[...texts].filter(([id,text])=>parents.get(id)===call.args.parentId && text.join('')===(call.args.name as string[]).join('')).map(([id])=>wire(id))[0];
      if (call.methodName === 'richText.toString') response=call.args.richText.join('');
      if (call.methodName === 'rem.getPowerupProperty') response = widget === 'workbench' || widget === 'study_packs' ? metadata.get(call.args.remId) : JSON.stringify(schema);
      if (call.methodName === 'rem.setPowerupProperty' && (widget === 'workbench' || widget === 'study_packs')) metadata.set(call.args.remId, call.args.value[0]);
      if (call.methodName === 'powerup.getPowerupByCode') {
        const id=`powerup:${call.args.powerupCode}`; parents.set(id,null); response=wire(id);
      }
      if (call.methodName === 'rem.taggedRem') response = [...tags].filter(([,codes])=>codes.has(call.args.remId) || codes.has(call.args.remId.slice('powerup:'.length))).map(([id])=>wire(id));
      if (call.methodName === 'rem.createRem') {
        const id=`fixture-created-${++createdRems}`; parents.set(id,null); response=wire(id);
      }
      if (call.methodName === 'storage.getSynced') response = saved.get(call.args.key);
      if (call.methodName === 'storage.setSynced') saved.set(call.args.key, call.args.value);
      source.postMessage({ isIntendedForRemNoteAPIPlugin: true, messageId: call.messageId, response }, '*');
    });
  }, { widget, focusedVocabulary: options.focusedVocabulary !== false, focusedRemId:options.focusedRemId, translationDirection:options.translationDirection, nativeStudy:options.nativeStudy, nativeQueueSkill:options.nativeQueueSkill,nativeQueueAudioAvailable:options.nativeQueueAudioAvailable,nativeQueueAudioUrl:options.nativeQueueAudioUrl,nativeMode:options.nativeMode,nativeOral:options.nativeOral,courseSeed,pausedStudyCards:options.pausedStudyCards,emptyCardLookupOnce:options.emptyCardLookupOnce,nativeQueueOverride });
  await page.goto(`${options.secureHost ? 'https' : 'http'}://hanzi-startup.test/host`);
  const frame = page.frameLocator('#sdk-widget');
  // HTTPS assets can still lack secure-context APIs under a non-trustworthy app ancestor.
  // The browser itself removes randomUUID; the test does not stub the API or SDK.
  const loadedFrame = options.nativeMode ? page.mainFrame() : page.frames().find(child => child.url().startsWith('https://hanzi-plugin.test/'))!;
  const capabilities = await loadedFrame.evaluate(() => ({ secure: isSecureContext,
    randomUUID: typeof crypto.randomUUID, getRandomValues: typeof crypto.getRandomValues }));
  return { frame, nativeRoot:page.locator('#native-mount'), capabilities, calls, errors };
}
