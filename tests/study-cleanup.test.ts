import {describe,it,expect,vi} from 'vitest';
import {memoryRemNote} from './helpers/remnote-memory';
import {auditNativeStudyCleanup,CLEANUP_REQUEST_PREFIX,CLEANUP_REPORT_PREFIX,pruneStudyReferences,type CleanupRequest} from '../src/studyPacks/cleanup';
import {NATIVE_LIST_KEY,EXERCISE_PREFIX} from '../src/studyPacks/nativeRems';
import {coursePack,courseItem} from './helpers/course-pack';
async function fixture(){
  const m=memoryRemNote(),root=m.add('root'),card=m.add('obsolete'),config=m.add('config'),request=m.add('request'),report=m.add('report');
  await card.setParent(root._id);await config.setParent(card._id);await request.setParent(root._id);await report.setParent(root._id);
  const metadata=EXERCISE_PREFIX+JSON.stringify({id:'initials-0',section:2,kind:'choice',mode:'initials'});
  await card.setText(['Classify this sound: b']);await card.setBackText(['initial']);await config.setText([metadata]);
  const auditedCard=Object.assign(card,{createdAt:100,remsReferencingThis:vi.fn(async()=>[] as {_id:string}[]),portalsAndDocumentsIn:vi.fn(async()=>[root])});
  const plan:CleanupRequest={version:1,studyPackId:'test-pack',reportRemId:report._id,phase:'before',retainedRemIds:[],candidates:[{remId:card._id,configRemId:config._id,itemId:'initials-0',parentId:root._id,createdAt:100,front:'Classify this sound: b',back:'initial',config:metadata}]};
  await request.setText([CLEANUP_REQUEST_PREFIX+JSON.stringify(plan)]);m.saved.set(NATIVE_LIST_KEY,root._id);
  const result=()=>JSON.parse(report.text[0].slice(CLEANUP_REPORT_PREFIX.length));return{...m,card:auditedCard,config,request,report,plan,result};
}
describe('explicitly authorized midterm cleanup preserves unrelated material',()=>{
  it('audits exact creations without performing any deletion or scheduling change',async()=>{
    const m=await fixture();await auditNativeStudyCleanup(m.plugin);expect(m.result().rows[0].status).toBe('exclusive-midterm');expect(m.result().retainedUnchanged).toBe(true);
    expect(m.createRem).not.toHaveBeenCalled();expect(m.card.setText).toHaveBeenCalledTimes(1);expect(m.card.setPracticeDirection).not.toHaveBeenCalled();
  });
  it('reads disabled native cards by their recorded IDs without reactivating or losing their scheduling audit',async()=>{
    const m=await fixture(),kept=m.add('kept'),native={_id:'scheduled-card',remId:'kept',type:'forward',createdAt:1,repetitionHistory:[{date:2,score:3}],nextRepetitionTime:500};
    const getCards=vi.fn(async()=>[native]);Object.assign(kept,{getCards});
    const findMany=vi.fn(async()=>[native]);Object.assign(m.plugin,{card:{findMany}});
    m.plan.retainedRemIds=['kept'];await m.request.setText([CLEANUP_REQUEST_PREFIX+JSON.stringify(m.plan)]);
    await auditNativeStudyCleanup(m.plugin);getCards.mockResolvedValue([]);await auditNativeStudyCleanup(m.plugin);
    expect(findMany).toHaveBeenCalledWith(['scheduled-card']);expect(m.result().retainedSchedulesUnchanged).toBe(true);
    expect(kept.setPracticeDirection).not.toHaveBeenCalled();
  });
  it('preserves a candidate with an external reference, foreign context, manual edit or unavailable sharing audit',async()=>{
    for(const change of ['reference','context','edit','unavailable']){const m=await fixture();
      if(change==='reference')m.card.remsReferencingThis.mockResolvedValue([{_id:'another-deck'}] as never);
      if(change==='context')m.card.portalsAndDocumentsIn.mockResolvedValue([m.add('another-deck')]);
      if(change==='edit')await m.card.setBackText(['my own answer']);
      if(change==='unavailable')m.card.remsReferencingThis.mockRejectedValue(Error('offline'));
      await auditNativeStudyCleanup(m.plugin);expect(m.result().rows[0].status,change).toBe('preserve');
    }
  });
  it('clears only removed item references and keeps a retained reading session and unrelated history',async()=>{
    const m=memoryRemNote(),pack=coursePack([courseItem({id:'keep'})]);pack.sourceVersion='cleaned';
    const prefix='hanzi-mastery-study-pack-v1:test-pack:';
    m.saved.set(prefix+'item:remove',{attempts:3});m.saved.set(prefix+'item:keep',{attempts:7});m.saved.set('hm:v2:writing:outside:4e00',{history:['keep']});
    m.saved.set(prefix+'session',{id:'session',sourceVersion:'old',ids:['remove','keep'],index:1,label:'Reading',draft:{itemId:'keep',answer:'saved',submitted:false}});
    await pruneStudyReferences(m.plugin.storage,pack,['remove']);expect(m.saved.get(prefix+'item:remove')).toBeNull();expect(m.saved.get(prefix+'item:keep')).toEqual({attempts:7});
    expect(m.saved.get(prefix+'session')).toMatchObject({ids:['keep'],index:0,sourceVersion:'cleaned',draft:{itemId:'keep',answer:'saved'}});
    const before=JSON.stringify([...m.saved]);await pruneStudyReferences(m.plugin.storage,pack,['remove']);expect(JSON.stringify([...m.saved])).toBe(before);expect(m.saved.get('hm:v2:writing:outside:4e00')).toEqual({history:['keep']});
  });
});
