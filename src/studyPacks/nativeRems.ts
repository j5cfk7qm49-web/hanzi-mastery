import type { RNPlugin } from '@remnote/plugin-sdk';
import { sha256 } from '@noble/hashes/sha2.js';
import type { StudyItem, StudyPack } from './model';
import {wordOrderHelp} from './wordOrderHelp';
import {particleHelp} from './particleHelp';

export const EXERCISE_PREFIX = 'Hanzi Mastery exercise: ';
export const LIST_PREFIX = 'Hanzi Mastery list: ';
export const EXPLANATION = ' Explanation:';
export const ALTERNATIVE = ' | ';
export const NATIVE_LIST_KEY = 'hanzi-mastery-native-study-list-v1';
export function studyListId(input:string):string {
  const raw=input.trim().split(/[?#]/)[0];
  if(!/^[a-z][a-z\d+.-]*:\/\//i.test(raw))return raw;
  const segment=decodeURIComponent(new URL(raw).pathname.split('/').filter(Boolean).pop()||'');
  // RemNote's /w/<kb>/<slug>-<id>, /a/<id> and /doc/<id> links.
  return /(?:^|-)([a-z\d]{17,24})$/i.exec(segment)?.[1] || segment;
}
type Config = Omit<StudyItem, 'prompt'|'answers'|'reveal'>;
async function remText(plugin:RNPlugin,value:Parameters<RNPlugin['richText']['toString']>[0]):Promise<string> {
  // getDescendants already returns plain text. Avoid thousands of redundant host
  // round trips on a phone; rich references/formatting still use the SDK converter.
  return value.every(part=>typeof part==='string') ? value.join('') : plugin.richText.toString(value);
}
export function exerciseConfig(item:StudyItem):Config {
  const {prompt,answers,reveal,...config}=item; return config;
}
function questionSuffix(item:Config):string {
  const visible=item.referenceGlyph || (item.kind!=='writing' ? item.glyph : undefined);
  const help=item.mode==='word-order' ? wordOrderHelp(item) : [];
  const context=item.mode==='particles' ? particleHelp(item) : [];
  return (visible ? ` [${visible}]` : '')+(item.kind==='oral' && item.showPinyin!==false && item.syllables?.length ? ` (${item.syllables.join(' ')})` : '')+(help.length ? ` (${help.map(h=>`${h.character} ${h.pinyin}: ${h.meaning}`).join('; ')})` : '')+(context.length ? ` (Vocabulary: ${context.map(h=>`${h.text} ${h.pinyin}: ${h.meaning}`).join('; ')})` : '');
}
export function nativeFront(item:StudyItem) { return item.prompt+questionSuffix(item); }
export function nativeBack(item:StudyItem) { return item.answers.join(ALTERNATIVE) + (item.reveal ? EXPLANATION+' '+item.reveal : ''); }
const plain = (text:string) => text.replace(/[\r\n]+/g,' ').replace(/\t/g,' ');
/** Ordinary native cards, with one editable child describing the interaction. */
export function itemMarkdown(item:StudyItem):string {
  // Include a visible target in the native prompt; the mode displays it separately.
  const front=nativeFront(item);
  return `- ${plain(front)} >> ${plain(nativeBack(item))}\n  - ${EXERCISE_PREFIX}${JSON.stringify(exerciseConfig(item))}`;
}
export function listMetadata(pack:StudyPack):string {
  const {studyPackId,sections,audio,notes}=pack;
  return LIST_PREFIX+JSON.stringify({schemaVersion:1,studyPackId,sections,audio,notes,audioVersion:pack.audioVersion || pack.sourceVersion,...(pack.scheduledCardsPaused===true ? {scheduledCardsPaused:true} : {})});
}
export interface NativeStudySource {
  load():Promise<StudyPack|undefined>;
  install(pack:StudyPack):Promise<void>;
  connect(id:string):Promise<void>;
  hide():Promise<void>;
}
/** Rem text is the content authority. Synced storage contains only a list pointer. */
export class RemStudySource implements NativeStudySource {
  constructor(readonly plugin:RNPlugin, readonly onProgress?:(message:string)=>void) {}
  private async savePointer(key:string,value:unknown) {
    await this.plugin.storage.setSynced(key,value);
    if(JSON.stringify(await this.plugin.storage.getSynced(key))!==JSON.stringify(value))throw new Error('The import identity was not confirmed. Keep this window open and retry before creating another list.');
  }
  async connect(input:string) {
    const id=studyListId(input);
    if(!id || !await this.plugin.rem.findOne(id))throw new Error('That study list is unavailable. Copy its Rem ID or document link.');
    await this.read(id);
    await this.savePointer(NATIVE_LIST_KEY,id);
  }
  async hide() {await this.savePointer(NATIVE_LIST_KEY,'');}
  async load():Promise<StudyPack|undefined> {
    const id=await this.plugin.storage.getSynced<string>(NATIVE_LIST_KEY);if(!id)return;
    return this.read(id);
  }
  private async read(id:string):Promise<StudyPack> {
    const root=await this.plugin.rem.findOne(id);if(!root)throw new Error('The selected study list is unavailable. Its progress has been retained.');
    const rems=await root.getDescendants(), values=new Map<string,{front:string;back:string;parent:string|null}>();
    for(let offset=0;offset<rems.length;offset+=24)await Promise.all(rems.slice(offset,offset+24).map(async rem=>{
      values.set(rem._id,{front:await remText(this.plugin,rem.text||[]),back:await remText(this.plugin,rem.backText||[]),parent:rem.parent});
    }));
    const metadata=[...values.values()].filter(v=>v.front.startsWith(LIST_PREFIX));
    if(metadata.length!==1)throw new Error('Choose the parent study list containing exactly one Hanzi Mastery list settings Rem.');
    const config=JSON.parse(metadata[0].front.slice(LIST_PREFIX.length));
    if(config.schemaVersion!==1 || typeof config.studyPackId!=='string' || !Array.isArray(config.sections) || !Array.isArray(config.audio))throw new Error('Study list settings are invalid.');
    const items:StudyItem[]=[], ids=new Set<string>();
    for(const rem of values.values()) {
      if(!rem.front.startsWith(EXERCISE_PREFIX))continue;
      const c=JSON.parse(rem.front.slice(EXERCISE_PREFIX.length)) as Config;
      const card=rem.parent ? values.get(rem.parent) : undefined;
      if(!card)throw new Error('An exercise settings Rem must be a child of its native flashcard.');
      if(typeof c.id!=='string' || ids.has(c.id) || !['oral','text','choice','circle','writing'].includes(c.kind) || typeof c.mode!=='string' || !Number.isInteger(c.section))throw new Error('An exercise has invalid or duplicate settings.');
      if(['oral','circle','writing'].includes(c.kind) && (typeof c.glyph!=='string' || !c.glyph))throw new Error('This exercise type needs a target in its settings Rem.');
      if(c.kind==='choice' && (!Array.isArray(c.choices) || !c.choices.every(v=>typeof v==='string')))throw new Error('Choice options are invalid.');
      const split=card.back.indexOf(EXPLANATION), answer=(split<0 ? card.back : card.back.slice(0,split)).replace(/ —$/,'');
      if(!answer.trim())throw new Error('A native exercise card has no answer. Restore its back before practicing.');
      if(c.kind==='writing' && !/^\p{Script=Han}$/u.test(answer.trim()))throw new Error('A writing card answer must be one Han character or radical.');
      const suffix=questionSuffix(c);
      const prompt=suffix && card.front.endsWith(suffix) ? card.front.slice(0,-suffix.length) : card.front;
      items.push({...c,remId:[...values].find(([,v])=>v===card)![0],prompt,answers:answer.split(ALTERNATIVE).map(a=>a.trim()),reveal:split<0 ? '' : card.back.slice(split+EXPLANATION.length).trimStart()});ids.add(c.id);
    }
    if(!items.length)throw new Error('No configured exercise cards were found in this list.');
    // RPC completion order must not change the session version or shuffle inputs.
    items.sort((a,b)=>a.section-b.section || (a.id<b.id ? -1 : a.id>b.id ? 1 : 0));
    // Adding or editing display-only aids must not discard an in-progress list.
    // Questions, accepted answers and exercise identities still version the session.
    const content=JSON.stringify(items.map(item=>{if(item.mode==='word-order'){const {syllables,glosses,...question}=item;return question;}if(item.mode==='particles'){const {targetParticle,contextHints,...question}=item;return question;}return item;})), version=[...sha256(new TextEncoder().encode(content))].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,24);
    const nativeById=new Map(rems.map(rem=>[rem._id,rem]));
    const audio=await Promise.all(config.audio.map(async(asset:StudyPack['audio'][number])=>{
      if(!asset.remId)return {...asset,url:undefined};
      try {
        const attachment=nativeById.get(asset.remId) || await this.plugin.rem.findOne(asset.remId);
        const media=[...(attachment?.text||[]),...(attachment?.backText||[])].find(part=>typeof part==='object' && part.i==='a' && (typeof part.url==='string' || ('ur' in part && typeof part.ur==='string')));
        const url=media && typeof media==='object' ? String(('url' in media && media.url) || ('ur' in media && media.ur) || '') : '';
        // Resolve current attachment text on every reload; no binary data or signed URL mirror.
        return {...asset,url:/^https:\/\//i.test(url) ? url : undefined};
      }catch {
        // One unavailable attachment must not block unrelated writing or text practice.
        return {...asset,url:undefined};
      }
    }));
    return {...config,audio,title:await remText(this.plugin,root.text||[]),sourceVersion:version,items};
  }
  async install(pack:StudyPack) {
    const current=await this.plugin.storage.getSynced<string>(NATIVE_LIST_KEY);
    if(current) {
      const existing=await this.load();
      if(existing?.studyPackId===pack.studyPackId)return; // Never overwrite edits or imported schedules.
      throw new Error('Another list is connected. Disconnect it before creating a new study list.');
    }
    // Persist the root before writing content so an interrupted import can be recovered.
    const draftKey=NATIVE_LIST_KEY+':draft:'+pack.studyPackId;
    let rootId=await this.plugin.storage.getSynced<string>(draftKey),root=rootId ? await this.plugin.rem.findOne(rootId) : undefined;
    if(!root) {root=await this.plugin.rem.createRem();if(!root)throw new Error('RemNote could not create the study list.');rootId=root._id;await this.savePointer(draftKey,rootId);await root.setText([pack.title]);await root.setIsDocument(true);}
    const existing=await root.getDescendants();
    const known=new Set<string>();
    for(const rem of existing) {const s=await remText(this.plugin,rem.text||[]);if(s.startsWith(EXERCISE_PREFIX)){
      const parent=rem.parent ? await this.plugin.rem.findOne(rem.parent) : undefined;
      if(parent && await parent.getPracticeDirection()==='forward')known.add(JSON.parse(s.slice(EXERCISE_PREFIX.length)).id);
    }}
    if(!existing.some(r=>r.text?.some(t=>typeof t==='string' && t.startsWith(LIST_PREFIX)))) {
      const meta=await this.plugin.rem.createRem();if(!meta)throw new Error('Could not create list settings.');
      await meta.setText([listMetadata(pack)]);await meta.setParent(rootId!);
    }
    let complete=known.size;this.onProgress?.(`Creating native RemNote cards (${complete}/${pack.items.length})… Keep this window open.`);
    for(const section of pack.sections) {
      const name=`${section.id}. ${section.title}`;
      let parent=await this.plugin.rem.findByName([name],rootId!);
      if(!parent){parent=await this.plugin.rem.createRem();if(!parent)throw new Error('Could not create a section. Retry the same ZIP.');await parent.setText([name]);await parent.setParent(rootId!);}
      const pendingItems=pack.items.filter(i=>i.section===section.id && !known.has(i.id));
      for(let offset=0;offset<pendingItems.length;offset+=4) {
        // Independent new cards can overlap host latency. Keep each card's writes
        // ordered, and settle the entire batch before offering a safe retry.
        const results=await Promise.allSettled(pendingItems.slice(offset,offset+4).map(async item=>{
        // Save identity before each write so a partial import resumes that same card.
        const key=draftKey+':item:'+item.id;
        let identity=await this.plugin.storage.getSynced<{card?:string;config?:string}>(key)||{};
        let card=identity.card ? await this.plugin.rem.findOne(identity.card) : undefined;
        if(!card){card=await this.plugin.rem.createRem();if(!card)throw new Error('Could not create a card. Retry the same ZIP.');identity.card=card._id;await this.savePointer(key,identity);}
        await card.setPracticeDirection('none');
        await card.setText([nativeFront(item)]);
        await card.setBackText([nativeBack(item)]);await card.setParent(parent._id);
        let meta=identity.config ? await this.plugin.rem.findOne(identity.config) : undefined;
        if(!meta){meta=await this.plugin.rem.createRem();if(!meta)throw new Error('Could not create exercise settings. Retry the same ZIP.');identity.config=meta._id;await this.savePointer(key,identity);}
        await meta.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(item))]);await meta.setParent(card._id);
        await card.setPracticeDirection('forward');
        complete++;if(complete%10===0 || complete===pack.items.length)this.onProgress?.(`Creating native RemNote cards (${complete}/${pack.items.length})… Keep this window open.`);
        }));
        const failure=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');
        if(failure)throw failure.reason;
      }
    }
    await this.connect(rootId!);
    const confirmed=await this.load();if(confirmed?.items.length!==pack.items.length)throw new Error('The imported card count was not confirmed. Keep this list and retry.');
  }
}
