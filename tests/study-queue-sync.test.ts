import {describe,it,expect,vi} from 'vitest';
import type {Card} from '@remnote/plugin-sdk';
import {memoryRemNote} from './helpers/remnote-memory';
import {courseItem} from './helpers/course-pack';
import {StudyPackRepository} from '../src/studyPacks/repository';
import {EXERCISE_PREFIX,exerciseConfig,nativeFront,nativeBack} from '../src/studyPacks/nativeRems';
import {syncStudyResult} from '../src/studyPacks/queueSync';

async function fixture(){
  const memory=memoryRemNote(),{plugin,add}=memory,repo=new StudyPackRepository(plugin.storage),item=courseItem({remId:'rem'});
  const rem=add('rem'),config=add('config');await config.setParent(rem._id);await config.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(item))]);
  await rem.setText([nativeFront(item)]);await rem.setBackText([nativeBack(item)]);
  const history=[{date:10,score:0.5}],original=JSON.stringify(history);let due=123;
  const update=vi.fn(async(score:number)=>{history.push({date:20,score});due=456;});
  const card=()=>({_id:'card',remId:'rem',type:'forward',repetitionHistory:history.map(r=>({...r})),nextRepetitionTime:due,updateCardRepetitionStatus:update}) as unknown as Card;
  // The real RemNote host omits paused cards from Rem.getCards.
  const linkedRem=Object.assign(rem,{getCards:async():Promise<Card[]>=>[],getEnablePractice:async()=>false});Object.assign(plugin,{card:{findOne:vi.fn(async()=>card()),getAll:vi.fn(async()=>[card()])}});
  const event={id:'session:item',at:20,passed:true,assessment:'self' as const};
  return {...memory,repo,item,rem:linkedRem,config,card,history,original,update,event,sync:()=>syncStudyResult(plugin,repo,'pack',item,event)};
}
describe('course results and RemNote schedules',()=>{
  it.each([true,false])('appends one Good/Again for passed=%s, preserving history and paused state',async passed=>{
    const f=await fixture();f.event.passed=passed;expect(await f.sync()).toContain('updated');expect(f.update).toHaveBeenCalledExactlyOnceWith(passed ? 1 : 0);
    expect(JSON.stringify(f.history.slice(0,1))).toBe(f.original);expect(f.card().nextRepetitionTime).toBe(456);expect(await f.rem.getEnablePractice()).toBe(false);
    expect(f.rem.setPracticeDirection).not.toHaveBeenCalled();await f.sync();expect(f.update).toHaveBeenCalledTimes(1);
  });
  it('serializes duplicate completion callbacks',async()=>{const f=await fixture();await Promise.all([f.sync(),f.sync()]);expect(f.update).toHaveBeenCalledTimes(1);});
  it('reconciles an applied RPC whose response was lost, without rating twice',async()=>{
    const f=await fixture();f.update.mockImplementation(async score=>{f.history.push({date:20,score});throw Error('Lost reply');});await expect(f.sync()).rejects.toThrow('Lost reply');
    expect(await f.sync()).toContain('read back');expect(f.update).toHaveBeenCalledTimes(1);
  });
  it('does not resend an ambiguous RPC that never returned a confirmed rating',async()=>{
    const f=await fixture();f.update.mockRejectedValue(Error('Disconnected'));await expect(f.sync()).rejects.toThrow('Disconnected');
    await expect(f.sync()).rejects.toThrow('will not be sent twice');expect(f.update).toHaveBeenCalledTimes(1);expect(f.history).toHaveLength(1);
  });
  it('reconciles a failed receipt save after a successful card rating',async()=>{
    const f=await fixture(),save=f.plugin.storage.setSynced;let fail=true;
    vi.spyOn(f.plugin.storage,'setSynced').mockImplementation(async(key,value)=>{if(fail && (value as any)?.state==='confirmed')throw Error('Receipt unavailable');return save(key,value);});
    await expect(f.sync()).rejects.toThrow('Receipt unavailable');fail=false;await f.sync();expect(f.update).toHaveBeenCalledTimes(1);
  });
  it('leaves unlinked, changed, missing and ambiguous cards untouched',async()=>{
    const f=await fixture();expect(await syncStudyResult(f.plugin,f.repo,'pack',{...f.item,remId:undefined},f.event)).toContain('No linked');
    await f.config.setText([EXERCISE_PREFIX+JSON.stringify({...exerciseConfig(f.item),id:'different'})]);await expect(f.sync()).rejects.toThrow('unique matching');
    await f.config.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(f.item))]);Object.assign(f.rem,{getCards:async()=>[f.card(),{...f.card(),_id:'other'}]});await expect(f.sync()).rejects.toThrow('unique matching');
    f.rems.delete('rem');await expect(f.sync()).rejects.toThrow('unavailable');expect(f.update).not.toHaveBeenCalled();
  });
  it('keeps an uncertain receipt unresolved if other history changed',async()=>{
    const f=await fixture();f.update.mockRejectedValue(Error('Disconnected'));await expect(f.sync()).rejects.toThrow();f.history.push({date:30,score:0});
    await expect(f.sync()).rejects.toThrow('unconfirmed');expect(f.update).toHaveBeenCalledTimes(1);
  });
  it('does not rate a card whose answer changed during the exercise',async()=>{
    const f=await fixture();await f.rem.setBackText(['Different answer']);await expect(f.sync()).rejects.toThrow('edited during practice');expect(f.update).not.toHaveBeenCalled();
  });
  it('accepts the same editable question without a glyph suffix and with answer whitespace',async()=>{
    const f=await fixture();await f.rem.setText([f.item.prompt]);await f.rem.setBackText(['  '+f.item.answers[0]+'  Explanation: '+f.item.reveal]);
    await f.sync();expect(f.update).toHaveBeenCalledTimes(1);
  });
  it('indexes paused cards once per list and stores no unrelated cards or review history',async()=>{
    const f=await fixture(),other={...f.card(),_id:'other-card',remId:'other-rem'} as Card;
    vi.mocked(f.plugin.card.getAll).mockResolvedValue([other,f.card()]);await f.sync();
    await syncStudyResult(f.plugin,f.repo,'pack',f.item,{...f.event,id:'another-session:item'});
    expect(f.plugin.card.getAll).toHaveBeenCalledTimes(1);expect(f.update).toHaveBeenCalledTimes(2);
    expect(f.saved.get(f.repo.key('pack','native-card-ids'))).toEqual({version:1,byRem:{rem:['card']}});
  });
  it('uses the visible-card lookup without enumerating the knowledge base when unpaused',async()=>{
    const f=await fixture();f.rem.getCards=async()=>[f.card()];await f.sync();expect(f.plugin.card.getAll).not.toHaveBeenCalled();
  });
  it('does not rate missing or ambiguous paused forward cards',async()=>{
    const f=await fixture();vi.mocked(f.plugin.card.getAll).mockResolvedValue([]);await expect(f.sync()).rejects.toThrow('unique matching forward');
    vi.mocked(f.plugin.card.getAll).mockResolvedValue([f.card(),{...f.card(),_id:'duplicate'} as Card]);await expect(f.sync()).rejects.toThrow('unique matching forward');expect(f.update).not.toHaveBeenCalled();
  });
});
