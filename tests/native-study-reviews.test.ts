import {describe,it,expect,vi} from 'vitest';
import {memoryRemNote} from './helpers/remnote-memory';
import {courseItem,coursePack} from './helpers/course-pack';
import {RemStudySource,EXERCISE_PREFIX,exerciseConfig,listMetadata,nativeFront,nativeBack,NATIVE_LIST_KEY} from '../src/studyPacks/nativeRems';
import {bindNativeStudyReviews,nativeReviewSchema,resolveNativeStudySchema} from '../src/services/nativeStudyReviews';
import {WRITING_POWERUP,SCHEMA_SLOT,parseWritingSchema} from '../src/core/schema';
import {RECALL_POWERUP,parseRecallSchema,checkRecall} from '../src/core/recall';

async function fixture(){
  const m=memoryRemNote(),root=m.add('root'),meta=m.add('meta');await meta.setParent(root._id);
  const pack=coursePack([
    courseItem({id:'radical',kind:'writing',mode:'radical-writing',glyph:'氵',referenceGlyph:'海',prompt:'Write only the radical.',answers:['氵']}),
    courseItem({id:'reading',kind:'text',mode:'radical-identity',glyph:'木',prompt:'Recall the Pinyin.',answers:['mù'],reveal:'tree'}),
    courseItem({id:'rule',kind:'text',mode:'rules',glyph:undefined,prompt:'Where does the tone mark go?',answers:['a first']}),
  ]);
  for(const item of pack.items){const card=m.add(item.id),config=m.add(item.id+'-config');await card.setParent(root._id);await config.setParent(card._id);await card.setText([nativeFront(item)]);await card.setBackText([nativeBack(item)]);await card.setPracticeDirection('forward');await config.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(item))]);}
  await meta.setText([listMetadata(pack)]);m.saved.set(NATIVE_LIST_KEY,root._id);
  return {...m,source:new RemStudySource(m.plugin)};
}
describe('native study cards reuse ordinary Hanzi queue modes',()=>{
  it('honors an explicit list pause for all configured cards, idempotently, without touching unrelated Rems or history',async()=>{
    const m=await fixture(),unrelated=m.add('independent-card'),pack=(await m.source.load())!;
    pack.scheduledCardsPaused=true;
    const before=pack.items.map(i=>{const rem=m.rems.get(i.remId!)!;return {rem,text:rem.text,back:rem.backText,direction:rem.setPracticeDirection.mock.calls.length};});
    await bindNativeStudyReviews(m.plugin,pack);await bindNativeStudyReviews(m.plugin,pack);
    for(const {rem,text,back,direction} of before){expect(await rem.getEnablePractice()).toBe(false);expect(rem.setEnablePractice).toHaveBeenCalledExactlyOnceWith(false);expect(rem.text).toEqual(text);expect(rem.backText).toEqual(back);expect(rem.setPracticeDirection).toHaveBeenCalledTimes(direction);}
    expect(await unrelated.getEnablePractice()).toBe(true);expect(unrelated.setEnablePractice).not.toHaveBeenCalled();
    pack.scheduledCardsPaused=false;await bindNativeStudyReviews(m.plugin,pack);
    for(const {rem} of before)expect(rem.setEnablePractice).toHaveBeenCalledTimes(1);
    await m.rems.get('meta')!.setText([listMetadata({...pack,scheduledCardsPaused:true})]);expect((await m.source.load())?.scheduledCardsPaused).toBe(true);
  });
  it('reports a pause that the host fails to retain',async()=>{
    const m=await fixture(),pack=(await m.source.load())!;pack.scheduledCardsPaused=true;
    m.rems.get('rule')!.setEnablePractice.mockImplementation(async()=>{});
    await expect(bindNativeStudyReviews(m.plugin,pack)).rejects.toThrow('paused queue state could not be confirmed');
  });
  it('uses ordinary spoken and listening modes for finals, consonants and a bounded sound group',()=>{
    const binding={configRemId:'config',studyPackId:'course',itemId:'sound'};
    const spoken=nativeReviewSchema(courseItem({id:'sound',section:2,kind:'oral',mode:'sound-recognition',glyph:'ai',answers:['ai'],showPinyin:false}),binding)!;
    expect(spoken).toMatchObject({skill:'pronunciation',traditional:'ai',phoneticOnly:true,referenceRequired:true});
    const group=nativeReviewSchema(courseItem({id:'sound',section:2,kind:'text',mode:'dictation',glyph:undefined,answers:['b p m f'],prompt:'Listen and type the group.',reveal:'The reference contains the group b, p, m, f.'}),binding)! as ReturnType<typeof parseRecallSchema>;
    expect(group).toMatchObject({skill:'listening',traditional:'b p m f',phoneticOnly:true,referenceRequired:true});
    expect(group.customPrompt).toBe('Listen and type the group.');
    expect(checkRecall(group,'b p m f')).toMatchObject({passed:true,total:4,spellingCorrect:4});
    expect(checkRecall(group,'b p f m')).toMatchObject({passed:false,total:4,spellingCorrect:2});
    expect(checkRecall(group,'b')).toMatchObject({passed:false,accuracy:0});
    expect(()=>parseRecallSchema(JSON.stringify({...group,traditional:'b p m f d',pinyin:'b p m f d'}))).toThrow();
    expect(()=>parseRecallSchema(JSON.stringify({...group,traditional:'大學',pinyin:'大學'}))).toThrow();
  });
  it('binds existing writing and Pinyin Rems without creating cards or changing fronts, backs or directions',async()=>{
    const m=await fixture(),pack=await m.source.load();
    const before=pack!.items.map(i=>{const r=m.rems.get(i.remId!)!;return {id:r._id,text:r.text,back:r.backText,writes:r.setPracticeDirection.mock.calls.length};});
    expect(await bindNativeStudyReviews(m.plugin,pack)).toBe(2);
    expect(await m.rems.get('radical')!.hasPowerup(WRITING_POWERUP)).toBe(true);
    expect(await m.rems.get('reading')!.hasPowerup(RECALL_POWERUP)).toBe(true);
    expect(await m.rems.get('rule')!.hasPowerup(RECALL_POWERUP)).toBe(false);
    for(const old of before){const r=m.rems.get(old.id)!;expect(r.text).toEqual(old.text);expect(r.backText).toEqual(old.back);expect(r.setPracticeDirection).toHaveBeenCalledTimes(old.writes);}
    expect(m.createRem).not.toHaveBeenCalled();
    const writes=m.rems.get('reading')!.setPowerupProperty.mock.calls.length;await bindNativeStudyReviews(m.plugin);expect(m.rems.get('reading')!.setPowerupProperty).toHaveBeenCalledTimes(writes);
  });
  it('reads the current Pinyin answer instead of the bootstrap metadata',async()=>{
    const m=await fixture();await bindNativeStudyReviews(m.plugin);const card=m.rems.get('reading')!;
    const stored=parseRecallSchema(await card.getPowerupProperty(RECALL_POWERUP));await card.setBackText(['mǔ Explanation: changed model']);
    const current=await resolveNativeStudySchema(m.plugin,card as any,stored);expect(current).toMatchObject({skill:'pinyin',traditional:'木',pinyin:'mǔ',meaning:'changed model'});
  });
  it('keeps the reference character separate from the exact radical writing target and retains its history identity',async()=>{
    const m=await fixture();await bindNativeStudyReviews(m.plugin);const card=m.rems.get('radical')!;
    const schema=await resolveNativeStudySchema(m.plugin,card as any,parseWritingSchema(await card.getPowerupProperty(WRITING_POWERUP)));
    expect(schema).toMatchObject({skill:'writing',traditional:'氵',referenceGlyph:'海',vocabularyId:'radical'});
    await m.rems.get('radical-config')!.setParent('reading');await expect(resolveNativeStudySchema(m.plugin,card as any,schema)).rejects.toThrow('no longer belong');
  });
  it('preserves unrelated existing Hanzi metadata and reports a conflict',async()=>{
    const m=await fixture(),card=m.rems.get('reading')!;await card.addPowerup(RECALL_POWERUP);
    const original=JSON.stringify({version:1,skill:'pinyin',traditional:'木',pinyin:'mù',meaning:'tree',vocabularyId:'user-word'});
    await card.setPowerupProperty(RECALL_POWERUP,SCHEMA_SLOT,[original]);await expect(bindNativeStudyReviews(m.plugin)).rejects.toThrow('unrelated');expect(await card.getPowerupProperty(RECALL_POWERUP)).toBe(original);
  });
  it('does not accept an unconfirmed queue binding',async()=>{
    const m=await fixture();vi.spyOn(m.rems.get('reading')!,'getPowerupProperty').mockResolvedValue('');await expect(bindNativeStudyReviews(m.plugin)).rejects.toThrow('not confirmed');
  });
  it('accepts both explicitly taught readings of an unpositioned radical without accepting the wrong tone',async()=>{
    const m=await fixture(),card=m.rems.get('reading')!,config=m.rems.get('reading-config')!;
    await card.setText(['Recall the Pinyin. [阝]']);await card.setBackText(['fù / yì Explanation: left mound, right city']);
    await config.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(courseItem({id:'reading',kind:'text',mode:'radical-variants',glyph:'阝'})))]);
    await bindNativeStudyReviews(m.plugin);const schema=parseRecallSchema(await card.getPowerupProperty(RECALL_POWERUP));
    expect(checkRecall(schema,'fu4').passed).toBe(true);expect(checkRecall(schema,'yi4').passed).toBe(true);expect(checkRecall(schema,'yi2').passed).toBe(false);
  });
  it('resolves a spoken reading from its current attached class recording and never substitutes an absent attachment',async()=>{
    const m=await fixture(),card=m.rems.get('reading')!,config=m.rems.get('reading-config')!,audio=m.add('class-audio');
    const item=courseItem({id:'reading',kind:'oral',mode:'reading',glyph:'大學之道',answers:['dà xué zhī dào'],syllables:['dà','xué','zhī','dào'],showPinyin:true,audioId:'line'});
    await card.setText([nativeFront(item)]);await card.setBackText([nativeBack(item)]);await config.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(item))]);
    await audio.setText([{i:'a',ur:'https://example.com/current-class-line.m4a'}] as any);
    const pack=(await m.source.load())!;pack.audio=[{id:'line',path:'line.m4a',bytes:1,sha256:'a'.repeat(64),remId:audio._id}];
    await bindNativeStudyReviews(m.plugin,pack);const stored=parseRecallSchema(await card.getPowerupProperty(RECALL_POWERUP));
    expect(await resolveNativeStudySchema(m.plugin,card as any,stored)).toMatchObject({skill:'pronunciation',referenceAudio:'https://example.com/current-class-line.m4a'});
    await audio.setText([]);await expect(resolveNativeStudySchema(m.plugin,card as any,stored)).rejects.toThrow('class recording is unavailable');
  });
  it('binds the reported eng listening card to its attached recording without changing the native card',async()=>{
    const m=await fixture(),card=m.rems.get('reading')!,config=m.rems.get('reading-config')!,audio=m.add('sound-audio');
    const item=courseItem({id:'reading',kind:'text',mode:'dictation',glyph:undefined,prompt:'Listen, then type the vowel or final you heard.',answers:['eng'],audioId:'eng'});
    await card.setText([nativeFront(item)]);await card.setBackText([nativeBack(item)]);await config.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(item))]);
    await audio.setText([{i:'a',url:'https://example.com/eng.mp3'}] as any);
    const pack=(await m.source.load())!;pack.audio=[{id:'eng',path:'eng.mp3',bytes:1,sha256:'a'.repeat(64),remId:audio._id}];
    await bindNativeStudyReviews(m.plugin,pack);const stored=parseRecallSchema(await card.getPowerupProperty(RECALL_POWERUP));
    const resolved=await resolveNativeStudySchema(m.plugin,card as any,stored) as typeof stored;
    expect(resolved).toMatchObject({skill:'listening',pinyin:'eng',phoneticOnly:true,referenceRequired:true,referenceAudio:'https://example.com/eng.mp3'});
    expect(checkRecall(resolved,'eng1').passed).toBe(true);expect(checkRecall(resolved,'en').passed).toBe(false);
    await audio.setText([{i:'a',url:'https://example.com/current-eng.mp3'}] as any);
    expect(await resolveNativeStudySchema(m.plugin,card as any,stored)).toMatchObject({referenceAudio:'https://example.com/current-eng.mp3'});
    expect(m.createRem).not.toHaveBeenCalled();expect(card.setPracticeDirection).toHaveBeenCalledTimes(1);
  });
  it('supports the taught final spelling aliases while keeping unavailable class recordings explicit',()=>{
    const schema=nativeReviewSchema(courseItem({id:'listen',kind:'text',mode:'dictation',glyph:undefined,answers:['iou','iu']}),{configRemId:'config',studyPackId:'course',itemId:'listen'})! as ReturnType<typeof parseRecallSchema>;
    expect(schema).toMatchObject({skill:'listening',referenceRequired:true,pinyinAlternatives:['iu']});
    expect(checkRecall(schema,'iu').passed).toBe(true);expect(checkRecall(schema,'iou1').passed).toBe(true);expect(checkRecall(schema,'ou').passed).toBe(false);
    expect(schema.referenceAudio).toBeUndefined();
    expect(()=>parseRecallSchema(JSON.stringify({...schema,phoneticOnly:false}))).toThrow();
  });
  it('does not reactivate cards paused through RemNote when their queue connection is refreshed',async()=>{
    const m=await fixture(),card=Object.assign(m.rems.get('reading')!,{getEnablePractice:vi.fn(async()=>false),setEnablePractice:vi.fn()});
    await bindNativeStudyReviews(m.plugin);expect(await card.getEnablePractice()).toBe(false);expect(card.setEnablePractice).not.toHaveBeenCalled();
    expect(card.setPracticeDirection).toHaveBeenCalledTimes(1);
  });
});
