import { QueueInteractionScore, type RNPlugin, type Card } from '@remnote/plugin-sdk';
import { serializeByKey } from '../services/serial';
import { EXERCISE_PREFIX,EXPLANATION,ALTERNATIVE,nativeFront } from './nativeRems';
import type { StudyItem, StudyEvent } from './model';
import { StudyPackRepository } from './repository';

interface QueueReceipt { cardId:string; score:QueueInteractionScore; before:NonNullable<Card['repetitionHistory']>; state:'pending'|'confirmed' }
interface CardIndex { version:1; byRem:Record<string,string[]> }
const history = (card:Card) => card.repetitionHistory || [];
/** Rem.getCards deliberately filters paused cards. Retain only native identities
 * for this list, and resolve their current history through CardNamespace. The
 * SDK's read-only getAll is needed once for a previously unindexed paused list. */
async function forwardCardIds(plugin:RNPlugin,repository:StudyPackRepository,packId:string,remId:string,remIds:string[],active:Card[]):Promise<string[]> {
  const key=repository.key(packId,'native-card-ids');
  return serializeByKey(plugin.storage,key,async()=>{
    const index=await plugin.storage.getSynced<CardIndex>(key);
    const visible=[...new Set(active.filter(c=>c.type==='forward' && c.remId===remId).map(c=>c._id))];
    if(visible.length){
      if(JSON.stringify(index?.byRem?.[remId])!==JSON.stringify(visible))await repository.confirm(key,{version:1,byRem:{...index?.byRem,[remId]:visible}});
      return visible;
    }
    if(index?.version===1 && index.byRem?.[remId]?.length)return index.byRem[remId];
    const wanted=new Set([...remIds,remId]),byRem:Record<string,string[]>={};
    for(const card of await plugin.card.getAll())if(wanted.has(card.remId) && card.type==='forward'){
      const ids=byRem[card.remId] ||= [];if(!ids.includes(card._id))ids.push(card._id);
    }
    await repository.confirm(key,{version:1,byRem:{...index?.byRem,...byRem}});
    return byRem[remId] || [];
  });
}
function sameQuestion(item:StudyItem,front:string,back:string){
  const suffix=nativeFront({...item,prompt:''}),prompt=suffix && front.endsWith(suffix) ? front.slice(0,-suffix.length) : front;
  const split=back.indexOf(EXPLANATION),answers=(split<0?back:back.slice(0,split)).replace(/ —$/,'').split(ALTERNATIVE).map(a=>a.trim());
  return prompt===item.prompt && JSON.stringify(answers)===JSON.stringify(item.answers) && (split<0?'':back.slice(split+EXPLANATION.length).trimStart())===item.reveal;
}
/** Append through RemNote's scheduler, never by rewriting history or due dates.
 * An intent is durable before the RPC. An uncertain response is reconciled by
 * read-back; it is never blindly resent (the SDK has no idempotency token). */
export async function syncStudyResult(plugin:RNPlugin, repository:StudyPackRepository, packId:string, item:StudyItem, event:StudyEvent, listRemIds:string[]=[]):Promise<string> {
  if(!item.remId)return 'Practice saved. No linked RemNote card to schedule.';
  const remId=item.remId;
  const key=repository.key(packId,'queue:'+encodeURIComponent(event.id));
  return serializeByKey(plugin.storage,key,async()=>{
    const prior=await plugin.storage.getSynced<QueueReceipt>(key);
    if(prior?.state==='confirmed')return 'RemNote card schedule already updated.';
    if(prior){
      const card=await plugin.card.findOne(prior.cardId), after=card && history(card);
      const appended=after?.slice(prior.before.length);
      if(card?.remId===item.remId && after && JSON.stringify(after.slice(0,prior.before.length))===JSON.stringify(prior.before) && appended?.length===1 && appended[0].score===prior.score){
        await repository.confirm(key,{...prior,state:'confirmed'});return 'RemNote card schedule updated and read back.';
      }
      throw Error('Practice is saved, but its RemNote rating is unconfirmed. It will not be sent twice. Reopen and retry to check the card history; skip this activity if it remains unavailable.');
    }
    const rem=await plugin.rem.findOne(item.remId);if(!rem)throw Error('The linked study Rem is unavailable. Practice is saved; reload Rems before retrying.');
    if(!sameQuestion(item,await plugin.richText.toString(rem.text||[]),await plugin.richText.toString(rem.backText||[])))
      throw Error('This study card was edited during practice. Its schedule is unchanged; reload Rems before rating the new version.');
    // Match its live exercise identity as well as its Rem ID. Never guess from text.
    const children=await rem.getChildrenRem();let matches=0;
    for(const child of children){
      const raw=await plugin.richText.toString(child.text||[]);
      if(raw.startsWith(EXERCISE_PREFIX)){const config=JSON.parse(raw.slice(EXERCISE_PREFIX.length));if(config.id===item.id && config.mode===item.mode && config.kind===item.kind)matches++;}
    }
    if(matches!==1)throw Error('Practice is saved. A unique matching exercise configuration could not be verified, so its schedule was left unchanged. Reload Rems before retrying.');
    const ids=await forwardCardIds(plugin,repository,packId,remId,listRemIds,await rem.getCards());
    if(ids.length!==1)throw Error('Practice is saved. A unique matching forward flashcard could not be verified, so its schedule was left unchanged. Reload Rems before retrying.');
    // SDK 0.0.46 cards returned by Rem.getCards inherit its Rem RPC context.
    // Refetch through CardNamespace so the rating uses the card endpoint.
    const card=await plugin.card.findOne(ids[0]);
    if(!card || card.type!=='forward' || card.remId!==item.remId)throw Error('The matching flashcard changed. Practice is saved; reload Rems before retrying.');
    const receipt:QueueReceipt={cardId:card._id,score:event.passed ? QueueInteractionScore.GOOD : QueueInteractionScore.AGAIN,before:history(card).map(r=>({...r})),state:'pending'};
    await repository.confirm(key,receipt);
    await card.updateCardRepetitionStatus(receipt.score);
    const after=await plugin.card.findOne(card._id);
    if(!after || after.remId!==item.remId || history(after).length!==receipt.before.length+1 || JSON.stringify(history(after).slice(0,-1))!==JSON.stringify(receipt.before) || history(after).at(-1)?.score!==receipt.score)
      throw Error('Practice is saved. RemNote has not confirmed the new rating yet; retry to check without sending another rating.');
    await repository.confirm(key,{...receipt,state:'confirmed'});
    return 'RemNote card schedule updated and read back.';
  });
}
