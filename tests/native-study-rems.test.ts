import {describe,it,expect,vi} from 'vitest';
import {memoryRemNote} from './helpers/remnote-memory';
import {coursePack,courseItem} from './helpers/course-pack';
import {RemStudySource,EXERCISE_PREFIX,LIST_PREFIX,exerciseConfig,nativeFront,nativeBack,listMetadata,NATIVE_LIST_KEY,studyListId} from '../src/studyPacks/nativeRems';
import {StudyPackRepository} from '../src/studyPacks/repository';

async function fixture(){
  const memory=memoryRemNote(),{plugin,add,saved}=memory;
  const root=add('study-list'),card=add('native-card'),config=add('config'),meta=add('list-settings');
  const pack=coursePack([courseItem({kind:'text',glyph:'木',answers:['mù'],reveal:'tree',mode:'radical-identity'})]);
  await root.setText(['My editable study list']);await card.setParent(root._id);await config.setParent(card._id);await meta.setParent(root._id);
  await card.setText(['Recall the radical. [木]']);await card.setBackText([nativeBack(pack.items[0])]);
  await config.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(pack.items[0]))]);await meta.setText([listMetadata(pack)]);
  Object.assign(root,{getDescendants:async()=>[card,config,meta]});saved.set(NATIVE_LIST_KEY,root._id);
  return {...memory,root,card,config,meta,source:new RemStudySource(plugin)};
}
describe('native Rem study content',()=>{
  it('retains the section resume, saved answer and progress when particle vocabulary is added',async()=>{
    const {source,card,config,plugin}=await fixture(),repo=new StudyPackRepository(plugin.storage,source);
    const item=courseItem({id:'particle',section:7,kind:'text',mode:'particles',glyph:'學而習',prompt:'Identify the function of 而.',answers:['conjunction'],reveal:'learn and review'});
    const write=async(value:typeof item)=>{await card.setText([nativeFront(value)]);await config.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(value))]);};
    await write(item);await card.setBackText([nativeBack(item)]);const before=(await source.load())!;
    await repo.saveSession(before.studyPackId,{id:'particle-session',section:7,sourceVersion:before.sourceVersion,ids:['particle'],index:0,label:'Particles',draft:{itemId:'particle',answer:'unfinished thought',submitted:false}});
    await repo.record(before.studyPackId,'particle',{id:'previous',at:1,passed:false,assessment:'self'});
    await write({...item,targetParticle:'而',contextHints:[{text:'學',pinyin:'xué',meaning:'learn'},{text:'習',pinyin:'xí',meaning:'review'}]});
    const after=(await source.load())!;expect(after.sourceVersion).toBe(before.sourceVersion);expect(after.items[0].prompt).toBe(item.prompt);expect(after.items[0].answers).toEqual(item.answers);
    expect((await repo.sessions(after))[7]).toMatchObject({id:'particle-session',draft:{answer:'unfinished thought'}});expect((await repo.item(after.studyPackId,'particle')).misses).toBe(1);
    await card.setBackText(['different function']);expect((await source.load())!.sourceVersion).not.toBe(before.sourceVersion);
  });
  it('keeps a word-order session and results when only visible Pinyin/meaning help changes',async()=>{
    const {source,card,config,plugin}=await fixture(),repo=new StudyPackRepository(plugin.storage,source);
    const item=courseItem({id:'order',section:7,kind:'choice',mode:'word-order',glyph:'父母',prompt:'Classify the word order.',choices:['Coordinate','Verb–object'],answers:['Coordinate'],reveal:'Model translation is revealed later.'});
    const write=async(value:typeof item)=>{await card.setText([nativeFront(value)]);await config.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(value))]);};
    await write(item);await card.setBackText([nativeBack(item)]);const before=(await source.load())!;
    await repo.saveSession(before.studyPackId,{id:'in-progress',section:7,sourceVersion:before.sourceVersion,ids:['order'],index:0,label:'Word order'});await repo.record(before.studyPackId,'order',{id:'previous',at:1,passed:false,assessment:'checked'});
    const helped={...item,syllables:['fù','mǔ'],glosses:['father','mother']};await write(helped);const after=(await source.load())!;
    expect(after.sourceVersion).toBe(before.sourceVersion);expect(after.items[0]).toMatchObject({prompt:item.prompt,syllables:['fù','mǔ'],glosses:['father','mother'],answers:['Coordinate']});expect((await repo.sessions(after))[7].id).toBe('in-progress');expect((await repo.item(after.studyPackId,'order')).misses).toBe(1);
    expect(nativeFront(helped)).toContain('父 fù: father; 母 mǔ: mother');expect(nativeFront(helped)).not.toContain('Coordinate');
    await card.setBackText(['Verb–object']);expect((await source.load())?.sourceVersion).not.toBe(before.sourceVersion);
  });
  it('keeps written practice available when one audio attachment lookup fails',async()=>{
    const {source,plugin,meta}=await fixture(),pack=coursePack();
    pack.audio=[{id:'offline',path:'private_assets/audio/offline.mp3',sha256:'a'.repeat(64),bytes:3,remId:'offline-rem'}];
    await meta.setText([listMetadata(pack)]);const find=plugin.rem.findOne;
    vi.spyOn(plugin.rem,'findOne').mockImplementation(async id=>{if(id==='offline-rem')throw Error('Attachment unavailable');return find(id);});
    const loaded=await source.load();expect(loaded?.items).toHaveLength(1);expect(loaded?.audio[0].url).toBeUndefined();
  });
  it('resolves synced native audio from its current Rem without mirroring the URL',async()=>{
    const {source,plugin,meta,add}=await fixture(),clip=add('audio-rem');
    const pack=coursePack();pack.audio=[{id:'clip',path:'private_assets/audio/clip.mp3',sha256:'a'.repeat(64),bytes:3,remId:clip._id}];
    await meta.setText([listMetadata(pack)]);
    await clip.setBackText([{i:'a',url:'https://files.remnote.com/private.mp3',onlyAudio:true}] as any);
    expect((await source.load())?.audio[0].url).toBe('https://files.remnote.com/private.mp3');
    await clip.setBackText([{i:'a',url:'https://files.remnote.com/updated.mp3',onlyAudio:true}] as any);
    expect((await source.load())?.audio[0].url).toBe('https://files.remnote.com/updated.mp3');
    expect((await source.load())?.audio[0].remId).toBe('audio-rem');
    await clip.setBackText([{i:'a',ur:'https://files.remnote.com/compact.mp3'}] as any);
    expect((await source.load())?.audio[0].url).toBe('https://files.remnote.com/compact.mp3');
  });
  it('keeps the visible reference separate from a native editable handwriting answer',async()=>{
    const {source,card,config}=await fixture();
    const item=courseItem({kind:'writing',mode:'radical-writing',glyph:'氵',referenceGlyph:'海',answers:['氵'],prompt:'Write the radical.'});
    await card.setText(['Write the radical. [海]']);await card.setBackText([nativeBack(item)]);await config.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(item))]);
    expect((await source.load())?.items[0]).toMatchObject({prompt:'Write the radical.',referenceGlyph:'海',answers:['氵']});
    await card.setBackText(['水 Explanation: canonical form']);
    expect((await source.load())?.items[0].answers).toEqual(['水']);
    await card.setBackText(['氵 / 水']);await expect(source.load()).rejects.toThrow('one Han character or radical');
  });
  it('settles independent import writes before a retry and leaves completed native cards untouched',async()=>{
    const {plugin,rems,createRem}=memoryRemNote(),source=new RemStudySource(plugin),original=createRem.getMockImplementation()!;
    let calls=0;vi.spyOn(plugin.rem,'createRem').mockImplementation(async()=>{if(++calls===7)return undefined;return original() as unknown as Awaited<ReturnType<typeof plugin.rem.createRem>>;});
    const pack=coursePack(Array.from({length:4},(_,i)=>courseItem({id:'item-'+i})));
    await expect(source.install(pack)).rejects.toThrow('create a card');
    const complete=[...rems.values()].filter(r=>r.backText.length);expect(complete).toHaveLength(3);
    const directions=complete.map(r=>r.setPracticeDirection.mock.calls.length);
    await source.install(pack);expect((await source.load())?.items).toHaveLength(4);
    expect([...rems.values()].filter(r=>r.backText.length)).toHaveLength(4);
    expect(complete.map(r=>r.setPracticeDirection.mock.calls.length)).toEqual(directions);
  });
  it('accepts normal RemNote document links and stops unconfirmed import identities before writing card content',async()=>{
    const id='abcdefghij1234567';
    for(const input of [id,`https://www.remnote.com/doc/${id}`,`https://www.remnote.com/a/${id}`,`https://www.remnote.com/w/knowledgebase/My-study-list-${id}?view=notes`,`app://js/w/knowledgebase/My-study-list-${id}`])expect(studyListId(input)).toBe(id);
    const {plugin,rems}=memoryRemNote();vi.spyOn(plugin.storage,'setSynced').mockResolvedValue(undefined);
    await expect(new RemStudySource(plugin).install(coursePack())).rejects.toThrow('identity was not confirmed');
    expect([...rems.values()].filter(r=>r.backText.length)).toHaveLength(0);
  });
  it('resumes an interrupted native import with the same card and preserves quoted source metadata',async()=>{
    const {plugin,rems,createRem}=memoryRemNote(),source=new RemStudySource(plugin);
    const original=createRem.getMockImplementation()!;let calls=0;
    vi.spyOn(plugin.rem,'createRem').mockImplementation(async()=>{if(++calls===5)return undefined;return original() as unknown as Awaited<ReturnType<typeof plugin.rem.createRem>>;});
    const pack=coursePack([courseItem({source:'Reader says "course target"',reveal:''})]);
    await expect(source.install(pack)).rejects.toThrow('exercise settings');
    const card=[...rems.values()].find(r=>r.backText.length)!;const id=card._id;
    await source.install(pack);const saved=(await source.load())!;
    expect(saved.items[0]).toMatchObject({remId:id,source:'Reader says "course target"',reveal:'',answers:['水']});
    expect([...rems.values()].filter(r=>r.backText.length)).toHaveLength(1);
    expect(await card.getPracticeDirection()).toBe('forward');
  });
  it('reads current native prompt/back/config, preserves stable progress, and invalidates stale sessions on edits',async()=>{
    const {plugin,source,card,config,saved}=await fixture(),repo=new StudyPackRepository(plugin.storage,source);
    const first=(await repo.pack())!;expect(first.title).toBe('My editable study list');expect(first.items[0]).toMatchObject({remId:'native-card',prompt:'Recall the radical.',answers:['mù'],reveal:'tree'});
    await repo.record(first.studyPackId,first.items[0].id,{id:'one',at:1,passed:true,assessment:'self'});
    await card.setBackText(['mù | mu4 — Explanation: wood']);
    await config.setText([EXERCISE_PREFIX+JSON.stringify({...exerciseConfig(first.items[0]),mode:'custom-mode'})]);
    const second=(await repo.pack())!;expect(second.sourceVersion).not.toBe(first.sourceVersion);expect(second.items[0].answers).toEqual(['mù','mu4']);expect(second.items[0].mode).toBe('custom-mode');expect((await repo.progress(second))[second.items[0].id].attempts).toBe(1);
    expect([...saved.keys()].some(k=>k.endsWith(':pack'))).toBe(false); // no content mirror
  });
  it('refuses missing answers and malformed/duplicate configurations rather than practicing stale content',async()=>{
    const {source,card,config}=await fixture();await card.setBackText([]);await expect(source.load()).rejects.toThrow('no answer');
    await card.setBackText(['answer']);await config.setText([EXERCISE_PREFIX+JSON.stringify({id:'x',section:3,kind:'writing',mode:'writing'})]);await expect(source.load()).rejects.toThrow('target');
  });
  it('keeps connected imported cards, identity, and schedules untouched on audio reimport or disconnect',async()=>{
    const {source,card,root,saved}=await fixture();const pack=(await source.load())!;
    const writes=card.setBackText.mock.calls.length;await source.install(pack);expect(card.setBackText).toHaveBeenCalledTimes(writes);
    await source.hide();expect(await source.load()).toBeUndefined();expect(saved.get(NATIVE_LIST_KEY)).toBe('');
    await source.connect(root._id);expect((await source.load())?.items[0].remId).toBe(card._id);
  });
  it('does not recreate a removed midterm item when an old ZIP is imported into the same connected list',async()=>{
    const m=await fixture(),before=(await m.source.load())!;
    const survivor=m.add('survivor'),settings=m.add('survivor-settings');await survivor.setParent(m.root._id);await survivor.setText(['Retained fact']);await survivor.setBackText(['answer']);
    await settings.setParent(survivor._id);await settings.setText([EXERCISE_PREFIX+JSON.stringify(exerciseConfig(courseItem({id:'retained',kind:'text',mode:'facts',glyph:undefined})))]);
    m.rems.delete(m.card._id);m.rems.delete(m.config._id);
    Object.assign(m.root,{getDescendants:async()=>[m.meta,survivor,settings]});
    const creates=m.createRem.mock.calls.length;await m.source.install(before);expect(m.createRem).toHaveBeenCalledTimes(creates);
    expect((await m.source.load())!.items.map(i=>i.id)).toEqual(['retained']);
    await m.source.install(before);expect(m.createRem).toHaveBeenCalledTimes(creates);
  });
});
