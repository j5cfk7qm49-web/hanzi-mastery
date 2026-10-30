import type {RNPlugin} from '@remnote/plugin-sdk';
import {sha256} from '@noble/hashes/sha2.js';
import {EXERCISE_PREFIX,NATIVE_LIST_KEY,RemStudySource} from './nativeRems';
import {PACK_NAMESPACE,type StudyPack,type StudySession} from './model';
import type {SyncedStore} from '../services/persistence';

export const CLEANUP_REQUEST_PREFIX='Hanzi Mastery cleanup request: ';
export const CLEANUP_REPORT_PREFIX='Hanzi Mastery cleanup report: ';
export const contentHash=(value:unknown)=>[...sha256(new TextEncoder().encode(JSON.stringify(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
export interface CleanupCandidate {remId:string;configRemId:string;itemId:string;parentId:string;createdAt:number;front:string;back:string;config:string}
export interface CleanupRequest {version:1;studyPackId:string;reportRemId:string;phase:'before'|'after'|'done';candidates:CleanupCandidate[];retainedRemIds:string[]}
interface CleanupAuditRow {remId:string;itemId:string;status:string;exact?:boolean;tags?:string[];references?:string[];contexts?:string[];reason?:string}

/** Only exact recorded midterm creations are candidates. Similar wording never establishes ownership. */
export async function auditNativeStudyCleanup(plugin:RNPlugin):Promise<void>{
  const rootId=await plugin.storage.getSynced<string>(NATIVE_LIST_KEY),root=rootId && await plugin.rem.findOne(rootId);if(!root)return;
  const descendants=await root.getDescendants();
  const string=async(value:typeof root.text)=>(value||[]).every(v=>typeof v==='string') ? (value||[]).join('') : plugin.richText.toString(value||[]);
  const requests=[];for(const rem of descendants){const value=await string(rem.text);if(value.startsWith(CLEANUP_REQUEST_PREFIX))requests.push({rem,value});}
  if(!requests.length)return;if(requests.length!==1)throw Error('Ambiguous cleanup requests; no card was changed.');
  const request=JSON.parse(requests[0].value.slice(CLEANUP_REQUEST_PREFIX.length)) as CleanupRequest;
  if(request.phase==='done')return;
  if(request.version!==1 || !Array.isArray(request.candidates) || !Array.isArray(request.retainedRemIds))throw Error('Invalid cleanup request.');
  const reportRem=await plugin.rem.findOne(request.reportRemId);if(!reportRem)throw Error('Cleanup audit report Rem is unavailable.');
  const namespace=`hm:study-cleanup:${rootId}:${requests[0].rem._id}:`,rows:CleanupAuditRow[]=[];
  for(const candidate of request.candidates){
    const rem=await plugin.rem.findOne(candidate.remId);if(!rem){rows.push({remId:candidate.remId,itemId:candidate.itemId,status:'absent'});continue;}
    try{
      const [config,children,tags,references,contexts]=await Promise.all([plugin.rem.findOne(candidate.configRemId),rem.getChildrenRem(),rem.getTagRems(),rem.remsReferencingThis(),rem.portalsAndDocumentsIn()]);
      const allowedContexts=new Set([rootId,candidate.parentId]);
      const exact=rem.parent===candidate.parentId && rem.createdAt===candidate.createdAt &&
        await string(rem.text)===candidate.front && await string(rem.backText)===candidate.back &&
        config?.parent===rem._id && await string(config.text)===candidate.config &&
        candidate.config.startsWith(EXERCISE_PREFIX) && JSON.parse(candidate.config.slice(EXERCISE_PREFIX.length)).id===candidate.itemId;
      const exclusive=children.length===1 && children[0]._id===candidate.configRemId && !tags.length && !references.length && contexts.every(context=>allowedContexts.has(context._id));
      rows.push({remId:rem._id,itemId:candidate.itemId,status:exact && exclusive?'exclusive-midterm':'preserve',exact,tags:tags.map(r=>r._id),references:references.map(r=>r._id),contexts:contexts.map(r=>r._id)});
    }catch{rows.push({remId:rem._id,itemId:candidate.itemId,status:'preserve',reason:'Ownership or sharing could not be verified.'});}
  }
  let baseline=await plugin.storage.getSynced<Record<string,unknown>>(namespace+'retained');
  const retained:Record<string,unknown>={};
  for(let offset=0;offset<request.retainedRemIds.length;offset+=8)await Promise.all(request.retainedRemIds.slice(offset,offset+8).map(async id=>{
    const rem=await plugin.rem.findOne(id);if(!rem)throw Error('A retained card is missing.');
    const cards=await rem.getCards();
    // Rem.getCards can omit disabled cards. Read recorded native IDs directly
    // rather than mistaking a deliberate pause for a lost review history.
    const expected=(baseline?.[id] as {cards?:{id:string}[]}|undefined)?.cards||[],missing=expected.filter(c=>!cards.some(active=>active._id===c.id));
    if(missing.length){
      const inactive=await plugin.card.findMany(missing.map(c=>c.id));
      for(const card of inactive){if(card.remId!==id)throw Error('A retained native card no longer belongs to its Rem.');cards.push(card);}
      if(missing.some(c=>!cards.some(card=>card._id===c.id)))throw Error('Retained scheduling could not be read while cards are paused. No schedule was changed.');
    }
    retained[id]={text:rem.text,backText:rem.backText,cards:cards.map(c=>({id:c._id,type:c.type,createdAt:c.createdAt,history:c.repetitionHistory,due:c.nextRepetitionTime,wrong:c.timesWrongInRow,last:c.lastRepetitionTime})).sort((a,b)=>a.id.localeCompare(b.id))};
  }));
  if(!baseline && request.phase==='before'){await plugin.storage.setSynced(namespace+'retained',retained);baseline=await plugin.storage.getSynced(namespace+'retained');}
  if(!baseline)throw Error('The retained-card baseline was not confirmed.');
  const changed=request.retainedRemIds.filter(id=>contentHash(retained[id])!==contentHash(baseline![id]));
  const schedulingChanged=request.retainedRemIds.filter(id=>contentHash((retained[id] as {cards:unknown}).cards)!==contentHash((baseline![id] as {cards:unknown}).cards));
  if(request.phase==='before' && !await plugin.storage.getSynced(namespace+'ownership'))await plugin.storage.setSynced(namespace+'ownership',rows);
  const ownership=await plugin.storage.getSynced<typeof rows>(namespace+'ownership')||[];
  if(request.phase==='after'){
    const deleted=request.candidates.filter(c=>rows.some(r=>r.remId===c.remId && r.status==='absent') && ownership.some(r=>r.remId===c.remId && r.status==='exclusive-midterm')).map(c=>c.itemId);
    const pack=await new RemStudySource(plugin).load();if(pack)await pruneStudyReferences(plugin.storage,pack,deleted);
  }
  await reportRem.setText([CLEANUP_REPORT_PREFIX+JSON.stringify({phase:request.phase,studyPackId:request.studyPackId,rootId,
    rows,retainedCount:request.retainedRemIds.length,retainedChanged:changed,retainedSchedulingChanged:schedulingChanged,retainedSchedulesUnchanged:schedulingChanged.length===0,retainedUnchanged:changed.length===0})]);
}
/** Null tombstones clear only retired item pointers; other histories and native SRS are untouched. */
export async function pruneStudyReferences(storage:SyncedStore,pack:StudyPack,removed:string[]){
  const prefix=PACK_NAMESPACE+encodeURIComponent(pack.studyPackId)+':',removedSet=new Set(removed);
  for(const id of removed){const key=prefix+'item:'+encodeURIComponent(id);if(await storage.getSynced(key))await storage.setSynced(key,null);
    const draft=NATIVE_LIST_KEY+':draft:'+pack.studyPackId+':item:'+id;if(await storage.getSynced(draft))await storage.setSynced(draft,null);}
  const session=await storage.getSynced<StudySession>(prefix+'session');
  if(session){const ids=session.ids.filter(id=>!removedSet.has(id));const index=session.ids.slice(0,session.index).filter(id=>!removedSet.has(id)).length;
    const next={...session,sourceVersion:pack.sourceVersion,ids,index,...(session.draft && removedSet.has(session.draft.itemId)?{draft:undefined}:{})};
    if(JSON.stringify(next)!==JSON.stringify(session))await storage.setSynced(prefix+'session',next);}
}
