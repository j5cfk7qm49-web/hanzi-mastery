import type { RNPlugin } from '@remnote/plugin-sdk';
import { WRITING_POWERUP, SCHEMA_SLOT, parseWritingSchema, type WritingSchema } from '../core/schema';
import { RECALL_POWERUP, parseRecallSchema, type RecallSchema } from '../core/recall';
import { EXERCISE_PREFIX, EXPLANATION, RemStudySource, NATIVE_LIST_KEY, nativeFront } from '../studyPacks/nativeRems';
import type { StudyItem, StudyPack } from '../studyPacks/model';
import { serializeByKey } from './serial';

/** The Rem remains authoritative; this link resolves current text on every review. */
export interface NativeStudyBinding { configRemId:string; studyPackId:string; itemId:string; audioRemId?:string }
type BoundSchema = (WritingSchema | RecallSchema) & { nativeStudy:NativeStudyBinding };
type Rem = NonNullable<Awaited<ReturnType<RNPlugin['rem']['findOne']>>>;
async function text(plugin:RNPlugin,value:Rem['text']) { return (value||[]).every(v=>typeof v==='string') ? (value||[]).join('') : plugin.richText.toString(value||[]); }
export function nativeReviewSchema(item:StudyItem,binding:NativeStudyBinding):BoundSchema|undefined {
  if(item.kind==='writing') return parseWritingSchema(JSON.stringify({version:2,skill:'writing',vocabularyId:item.id,
    traditional:item.answers[0],prompt:item.prompt,referenceGlyph:item.referenceGlyph,nativeStudy:binding})) as BoundSchema;
  const skill = item.kind==='oral' ? 'pronunciation' : item.kind==='text' && item.mode==='dictation' ? 'listening' : ['translation','radical-meaning'].includes(item.mode) ? 'chinese-to-english' :
    item.kind==='text' && item.glyph && (item.input==='pinyin' || ['pinyin','radical-identity','radical-variants'].includes(item.mode)) ? 'pinyin' : undefined;
  if(!skill)return;
  const readings=['pinyin','listening'].includes(skill) ? item.answers.flatMap(a=>a.split(/\s*\/\s*/)) : item.answers;
  const pinyin=skill==='chinese-to-english' ? '' : readings[0];
  const phoneticOnly=(skill==='pronunciation' && item.mode==='sound-recognition') || (skill==='listening' && !item.glyph);
  const customPrompt=item.prompt+(skill==='pronunciation' && phoneticOnly && item.reveal.includes('group b, p, m, f') ? ' The reference includes b, p, m, f; compare this sound within that group.' : '')+(skill==='pronunciation' && item.showPinyin!==false ? ` (${pinyin})` : '');
  return parseRecallSchema(JSON.stringify({version:1,skill,vocabularyId:item.remId||item.id,traditional:item.glyph || (phoneticOnly ? pinyin : ''),
    pinyin,meaning:skill==='chinese-to-english' ? item.answers.join(' / ') : item.reveal,
    customPrompt,nativeStudy:binding,...(phoneticOnly ? {phoneticOnly:true} : {}),...(['pronunciation','listening'].includes(skill) ? {referenceRequired:true} : {}),...(['pinyin','listening'].includes(skill) && readings.length>1 ? {pinyinAlternatives:readings.slice(1)} : {})})) as BoundSchema;
}
/** Resolve the current front/back and config at review time, including edited answers. */
export async function resolveNativeStudySchema(plugin:RNPlugin,rem:Rem,stored:WritingSchema|RecallSchema):Promise<WritingSchema|RecallSchema> {
  const binding=stored.nativeStudy;if(!binding)return stored;
  if(typeof binding.configRemId!=='string' || typeof binding.studyPackId!=='string' || typeof binding.itemId!=='string')throw Error('Invalid native study link.');
  const config=await plugin.rem.findOne(binding.configRemId);
  if(!config || config.parent!==rem._id)throw Error('The native exercise settings no longer belong to this card.');
  const raw=await text(plugin,config.text);if(!raw.startsWith(EXERCISE_PREFIX))throw Error('Native exercise settings are missing.');
  const item=JSON.parse(raw.slice(EXERCISE_PREFIX.length)) as StudyItem;
  if(item.id!==binding.itemId)throw Error('The native exercise identity changed.');
  const front=await text(plugin,rem.text),back=await text(plugin,rem.backText),split=back.indexOf(EXPLANATION);
  item.answers=(split<0 ? back : back.slice(0,split)).replace(/ —$/,'').split(' | ').map(v=>v.trim());
  item.reveal=split<0 ? '' : back.slice(split+EXPLANATION.length).trimStart();
  const suffix=nativeFront({...item,prompt:''});item.prompt=suffix && front.endsWith(suffix) ? front.slice(0,-suffix.length) : front;item.remId=rem._id;
  const schema=nativeReviewSchema(item,binding);
  if(!schema || schema.skill!==stored.skill)throw Error('The exercise mode changed. Reload the study list before reviewing.');
  if(schema.skill!=='writing' && binding.audioRemId){
    const audio=await plugin.rem.findOne(binding.audioRemId);
    const media=[...(audio?.text||[]),...(audio?.backText||[])].find(v=>typeof v==='object' && v.i==='a');
    const url=media && typeof media==='object' ? ('ur' in media ? media.ur : 'url' in media ? media.url : undefined) : undefined;
    if(typeof url!=='string')throw Error('The attached class recording is unavailable. Reopen this review after syncing RemNote.');
    schema.referenceAudio=url;
  }
  if(schema.skill==='pronunciation' && schema.phoneticOnly && !schema.referenceAudio)throw Error('The instructor reference for this sound is unavailable.');
  return schema.skill==='writing' ? schema : parseRecallSchema(JSON.stringify(schema));
}
/** Enable ordinary Hanzi Writing/Study widgets on compatible existing Rems. Never recreate or reschedule them. */
export async function bindNativeStudyReviews(plugin:RNPlugin,pack?:StudyPack):Promise<number> {
  return serializeByKey(plugin.storage,'hm:native-study-review-bindings',async()=>{
    const current=pack||await new RemStudySource(plugin).load();if(!current)return 0;
    const rootId=await plugin.storage.getSynced<string>(NATIVE_LIST_KEY),root=rootId && await plugin.rem.findOne(rootId);if(!root)return 0;
    const descendants=await root.getDescendants(),configs=new Map<string,string>();
    for(const rem of descendants){const raw=await text(plugin,rem.text);if(rem.parent && raw.startsWith(EXERCISE_PREFIX))configs.set(rem.parent,rem._id);}
    let count=0;
    for(let offset=0;offset<current.items.length;offset+=4)await Promise.all(current.items.slice(offset,offset+4).map(async item=>{
      const configRemId=item.remId && configs.get(item.remId);if(!configRemId)return;
      const rem=await plugin.rem.findOne(item.remId!);if(!rem)throw Error('A study card is unavailable. Reload Rems and retry.');
      // Explicit list preference includes ordinary choice/fact cards too. Only
      // configured descendants of the connected list are in scope. This changes
      // eligibility, never direction, repetitions, due dates, or history.
      if(current.scheduledCardsPaused===true){
        const enabled=await rem.getEnablePractice();
        if(enabled===true){
          await rem.setEnablePractice(false);
          if(await rem.getEnablePractice()!==false)throw Error('The paused queue state could not be confirmed. Reload Rems to retry.');
        }else if(enabled!==false)throw Error('The paused queue state could not be confirmed. Reload Rems to retry.');
      }
      const binding:NativeStudyBinding={configRemId,studyPackId:current.studyPackId,itemId:item.id,
        ...(item.audioId && current.audio.find(a=>a.id===item.audioId)?.remId ? {audioRemId:current.audio.find(a=>a.id===item.audioId)!.remId} : {})};
      let schema:BoundSchema|undefined;try{schema=nativeReviewSchema(item,binding);}catch{return;}if(!schema)return;
      const powerup=schema.skill==='writing' ? WRITING_POWERUP : RECALL_POWERUP;
      const tagged=await rem.hasPowerup(powerup),previous=tagged ? await rem.getPowerupProperty(powerup,SCHEMA_SLOT) : '';
      if(previous){const old=JSON.parse(previous);if(!old.nativeStudy || old.nativeStudy.configRemId!==configRemId)throw Error('A card already has unrelated Hanzi metadata. No existing metadata was replaced.');}
      if(!tagged)await rem.addPowerup(powerup);
      const value=JSON.stringify(schema);if(previous!==value)await rem.setPowerupProperty(powerup,SCHEMA_SLOT,[value]);
      if(await rem.getPowerupProperty(powerup,SCHEMA_SLOT)!==value)throw Error('The queue connection was not confirmed. Retry Reload Rems.');
      count++;
    }));
    return count;
  });
}
