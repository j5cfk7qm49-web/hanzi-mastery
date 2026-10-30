import { describe,it,expect,vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { compileClassicalChinese } from '../src/studyPacks/classicalChinese';
import { importHandoff,digest,audioManifestVersion } from '../src/studyPacks/import';
import { StudyPackRepository } from '../src/studyPacks/repository';
import { PACK_NAMESPACE, assessAnswer, normalizeAnswer } from '../src/studyPacks/model';
import { courseItem, coursePack, syntheticHandoff } from './helpers/course-pack';
import { memoryRemNote } from './helpers/remnote-memory';
import { DEFAULT_SETTINGS } from '../src/core/config';
import { newAttempt, failRecall, gradeAttempt } from '../src/core/attempt';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

describe('optional course conversion',() => {
  it('grades selection answers even if an imported config still carries a self-assessment flag',()=>{
    expect(assessAnswer(courseItem({kind:'choice',answers:['Pictograph'],selfGrade:true}),'Pictograph')).toBe('correct');
  });
  it('keeps audio identity across JSON/property ordering and content edits, but changes it for a changed clip',async()=>{
    const clips=[{id:'b',path:'private_assets/audio/b.mp3',sha256:'b'.repeat(64),bytes:2},{id:'a',path:'private_assets/audio/a.mp3',sha256:'a'.repeat(64),bytes:1}];
    const reordered=[...clips].reverse().map(c=>({bytes:c.bytes,sha256:c.sha256,path:c.path,id:c.id}));
    const before=await audioManifestVersion(clips);expect(await audioManifestVersion(reordered)).toBe(before);
    expect(await audioManifestVersion([{...clips[0],bytes:3},clips[1]])).not.toBe(before);
  });
  it('verifies SHA-256 when the embedded host lacks Web Crypto',async()=>{
    const original=globalThis.crypto;vi.stubGlobal('crypto',{});
    try {expect(await digest(strToU8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');}
    finally {vi.stubGlobal('crypto',original);}
  });
  it('enforces counts, scope, alternatives and manual fallback',() => {
    const pack=compileClassicalChinese(syntheticHandoff());
    expect(pack.items.filter(i => i.mode==='radical-writing')).toHaveLength(99);
    expect(pack.items.filter(i => i.mode==='radical-identity')).toHaveLength(57);
    expect(pack.items.filter(i => i.kind==='writing' && i.section===4).map(i => i.glyph).join('')).toBe('一二三四五六七八九十心');
    expect(pack.items.filter(i => i.kind==='oral' && i.section===1).map(i => i.glyph).join('')).toBe('大學之道在明明德');
    expect(pack.items.filter(i => i.mode==='radical-writing').every(i => i.kind==='writing' && i.referenceGlyph && !i.selfGrade)).toBe(true);
    expect(pack.items.filter(i=>i.kind==='oral' && i.section===1).every(i=>i.showPinyin)).toBe(true);
    expect(pack.items.find(i=>i.id==='formation-0')?.answers).toEqual(['Form and sound']);
    expect(pack.items.find(i => i.id==='order-1')?.answers).toEqual(['coordinate','modifier_modified']);
    expect(pack.items.find(i => i.glyph==='想')?.reveal).toContain('method absent from original slide');
    expect(pack.items.find(i => i.id==='dictation-ong')?.audioId).toBeUndefined();
  });
  it('keeps tested sounds, meanings and real lookups while omitting category/procedure/comparison drills',()=>{
    const pack=compileClassicalChinese(syntheticHandoff());
    expect(pack.items.some(i=>i.prompt.startsWith('Classify this sound:'))).toBe(false);
    expect(pack.items.filter(i=>i.mode==='sound-recognition')).toHaveLength(21);
    expect(pack.items.filter(i=>i.mode==='dictation')).toHaveLength(4); // Small synthetic vowel bank.
    expect(pack.items.filter(i=>i.mode==='radical-meaning')).toHaveLength(57);
    expect(pack.items.filter(i=>i.mode==='dictionary-lookup').map(i=>i.glyph).join('')).toBe('一二三四五六七八九十心');
    expect(pack.items.some(i=>i.id==='dictionary-lookup' || i.mode==='dictionary')).toBe(false);
    expect(pack.items.find(i=>i.id==='basic-3')?.reveal).not.toContain('214');
    expect(pack.items.filter(i=>i.mode==='formation').every(i=>i.kind==='choice')).toBe(true);
  });
  it('fills both sound modes using actual references and tests a shared recording as a group',()=>{
    const raw=syntheticHandoff() as Record<string,any>,before=compileClassicalChinese(raw);
    raw['audio_manifest.json'].files=['a','ai','an','d','b p m f'].map((label,i)=>({id:'sound-'+i,type:'pinyin',label,relative_path:`private_assets/audio/${i}.mp3`,bytes:1,sha256:'a'.repeat(64)}));
    raw['audio_manifest.json'].audio_count=5;
    const pack=compileClassicalChinese(raw);
    expect(pack.items.filter(i=>i.id.startsWith('sound-final-')).map(i=>i.glyph)).toEqual(['a','ai','an']);
    expect(pack.items.find(i=>i.id==='sound-final-ong')).toBeUndefined();
    expect(pack.items.find(i=>i.id==='dictation-ong')?.audioId).toBeUndefined();
    expect(pack.items.find(i=>i.id==='dictation-initial-d')).toMatchObject({mode:'dictation',kind:'text',answers:['d'],audioId:'sound-3'});
    expect(pack.items.find(i=>i.id==='dictation-initial-d')?.glyph).toBeUndefined();
    expect(pack.items.find(i=>i.id==='dictation-initial-b-p-m-f')).toMatchObject({answers:['b p m f'],audioId:'sound-4'});
    expect(['b','p','m','f'].every(c=>!pack.items.some(i=>i.id===`dictation-initial-${c}`))).toBe(true);
    expect(pack.items.filter(i=>i.section!==2)).toEqual(before.items.filter(i=>i.section!==2));
    expect(new Set(pack.items.map(i=>i.id)).size).toBe(pack.items.length);
  });
  it('rejects malformed imports and out-of-scope writing/oral prompts',() => {
    for(const change of ['count','reference','oral','formation','type','duplicate']) {
      const raw=syntheticHandoff() as Record<string,any>;
      if(change==='count')raw['radicals.json'].radicals.pop();
      if(change==='reference')raw['radical_recognition.json'].items[0].expected_radical_numbers=[999];
      if(change==='oral')raw['daxue_reading.json'].passage[0].characters='人之初';
      if(change==='formation')raw['formations.json'].items[0].answer='會意';
      if(change==='type')raw['pinyin.json'].simple_finals='bad';
      if(change==='duplicate')raw['formations.json'].items[1].id=raw['formations.json'].items[0].id;
      expect(() => compileClassicalChinese(raw),change).toThrow();
    }
  });
  it('accepts an explicit private component form without requiring the example character to be written',()=>{
    const raw=syntheticHandoff() as Record<string,any>;raw['radical_recognition.json'].items[0].writing_radical='氵';
    const item=compileClassicalChinese(raw).items.find(i=>i.id==='circle-0');
    expect(item).toMatchObject({kind:'writing',mode:'radical-writing',referenceGlyph:'倀',glyph:'氵',answers:['氵']});
  });
  it('imports additional numbered reading lines with explicit page audio and separate hidden memorization',()=>{
    const raw=syntheticHandoff() as Record<string,any>;
    raw['audio_manifest.json']={schema_version:1,audio_count:1,files:[{id:'page-audio',original_name:'page.mp3',relative_path:'private_assets/audio/page.mp3',bytes:3,sha256:'a'.repeat(64),type:'reading'}]};
    const reading=raw['daxue_reading.json'];
    reading.passage.push({line:3,characters:'在親民',pinyin_syllables:['zài','qīn','mín'],translation:'Love the people',audio_name:'page.mp3',audio_note:'Page recording covers several lines.'});
    reading.memorization={id:'opening-memory',prompt:'Recite the opening from memory.',characters:'大學之道，在明明德。',pinyin:'dà xué zhī dào, zài míng míng dé',note:'Reveal after reciting.'};
    const pack=compileClassicalChinese(raw),last=pack.items.find(i=>i.id==='oral-3')!,memory=pack.items.find(i=>i.id==='opening-memory')!;
    expect(pack.items.filter(i=>i.kind==='oral' && i.section===1)).toHaveLength(3);
    expect(last).toMatchObject({audioId:'page-audio',showPinyin:true,answers:['zài qīn mín']});
    expect(last.reveal).toContain('several lines');
    expect(memory).toMatchObject({kind:'text',mode:'memorization',selfGrade:true});expect(memory.glyph).toBeUndefined();expect(memory.prompt).not.toContain('大學之道');
    reading.passage[2].audio_name='missing.mp3';expect(()=>compileClassicalChinese(raw)).toThrow('recording is unavailable');
    delete reading.passage[2].audio_name;
    expect(compileClassicalChinese(raw).items.find(i=>i.id==='oral-3')?.audioId).toBeUndefined(); // Never reuse the opening clip for a later line.
    reading.passage[2].line=2;expect(()=>compileClassicalChinese(raw)).toThrow('numbered in order');
  });
  it('imports metadata-only archives, ignores private PDFs and rejects duplicate data',async () => {
    const raw=syntheticHandoff(), data=Object.fromEntries(Object.entries(raw).map(([name,value]) => ['handoff/data/'+name,strToU8(JSON.stringify(value))]));
    const imported=await importHandoff(zipSync({...data,'handoff/reference_pdfs/class.pdf':strToU8('private, ignored')}));
    expect(imported.audio.size).toBe(0);expect(imported.pack.items.length).toBeGreaterThan(200);
    expect(JSON.stringify(imported.pack)).not.toContain('private, ignored');
    await expect(importHandoff(zipSync({...data,'other/data/radicals.json':data['handoff/data/radicals.json']}))).rejects.toThrow('exactly one');
  });
  it('rejects altered recordings before any installation',async()=>{
    const raw=syntheticHandoff() as Record<string,any>;
    raw['audio_manifest.json']={schema_version:1,audio_count:1,files:[{id:'audio-test',relative_path:'private_assets/audio/test.mp3',bytes:3,sha256:'0'.repeat(64),type:'pinyin',label:'a'}]};
    const data=Object.fromEntries(Object.entries(raw).map(([name,value])=>['handoff/data/'+name,strToU8(JSON.stringify(value))]));
    await expect(importHandoff(zipSync({...data,'handoff/private_assets/audio/test.mp3':strToU8('bad')}))).rejects.toThrow('checksum');
  });
  it('never treats a plausible personal-name answer as wholly wrong',() => {
    const item=courseItem({kind:'text',mode:'facts',answers:['Cāng Jié'],selfGrade:false});
    expect(assessAnswer(item,'Cang Jie')).toBe('review');expect(assessAnswer(item,'Cāng Jié')).toBe('correct');
    expect(normalizeAnswer('Xī’ān')).toBe(normalizeAnswer("xī'ān"));
    expect(assessAnswer(courseItem({mode:'spelling',answers:['Xī’ān'],selfGrade:false}),"Xi'an")).toBe('correct');
  });
});

describe('course persistence stays separate from native reviews',() => {
  it('reimports and retries without resetting existing keys or duplicating results',async () => {
    const {plugin,saved}=memoryRemNote(),repo=new StudyPackRepository(plugin.storage),pack=coursePack();
    saved.set('hm:v2:writing:existing:4e00',{untouched:true});saved.set('hanzi-mastery-v1:old',{level:3});
    const event={id:'attempt-1',at:Date.now(),passed:false,assessment:'self' as const};
    await repo.install(pack);await Promise.all([repo.record(pack.studyPackId,pack.items[0].id,event),repo.record(pack.studyPackId,pack.items[0].id,event)]);
    await repo.install(pack);expect((await repo.progress(pack))[pack.items[0].id]).toMatchObject({attempts:1,misses:1,lastPassed:false});
    const session={id:'session-1',sourceVersion:pack.sourceVersion,ids:pack.items.map(i => i.id),index:0,label:'Missed',draft:{itemId:pack.items[0].id,answer:'left',submitted:true,points:[[[1,2],[3,4]]]}};
    await repo.saveSession(pack.studyPackId,session);
    const reopened=new StudyPackRepository(plugin.storage);expect(await reopened.session(pack.studyPackId)).toEqual(session);
    expect(await reopened.pack()).toEqual(pack);expect(saved.get('hm:v2:writing:existing:4e00')).toEqual({untouched:true});expect(saved.get('hanzi-mastery-v1:old')).toEqual({level:3});
    expect([...saved.keys()].filter(k => k.includes('test-pack')).every(k => k.startsWith(PACK_NAMESPACE))).toBe(true);
    await reopened.hide();expect(await reopened.pack()).toBeUndefined();await reopened.install(pack);
    expect((await reopened.item(pack.studyPackId,pack.items[0].id)).misses).toBe(1);
  });
  it('reports unconfirmed saves and safely retries the same event',async () => {
    const backing=new Map(),store={getSynced:async<T,>(key:string) => backing.get(key) as T,setSynced:vi.fn(async()=>{})};
    const repo=new StudyPackRepository(store),event={id:'stable',at:1,passed:true,assessment:'checked' as const};
    await expect(repo.record('pack','item',event)).rejects.toThrow('not be confirmed');
    store.setSynced.mockImplementation(async(key?:string,value?:unknown) => {backing.set(key,value);});
    expect((await repo.record('pack','item',event)).attempts).toBe(1);
  });
  it('keeps all four handwriting thresholds and reveal failure in a separate store',async () => {
    const {plugin,saved}=memoryRemNote(),repo=new StudyPackRepository(plugin.storage);
    expect(DEFAULT_SETTINGS.thresholds).toEqual([.6,.75,.9,.95]);
    const attempt=failRecall(newAttempt(1),'answer-revealed'),result=gradeAttempt(attempt,0,.6);
    expect(result.passed).toBe(false);
    await repo.writing('pack').save('writing-1','一',{id:'test',at:Date.now(),cardId:'practice',character:'一',result,attempt,source:'test'},DEFAULT_SETTINGS);
    expect([...saved.keys()].some(k => k.startsWith(PACK_NAMESPACE+'pack:writing:hm:v2:writing:'))).toBe(true);
    expect([...saved.keys()].some(k => k.startsWith('hm:v2:writing:'))).toBe(false);
  });
});

const privateRoot=process.env.HM_PRIVATE_HANDOFF || resolve('audit/midterm-handoff/Hanzi_Mastery_Midterm_Codex_Handoff');
describe.skipIf(!existsSync(resolve(privateRoot,'data/radicals.json')))('supplied private course (requires local handoff)',() => {
  it('compiles every supplied JSON file and exact course acceptance examples',async () => {
    const files=Object.fromEntries(readdirSync(resolve(privateRoot,'data')).filter(n=>n.endsWith('.json')).map(n => [n,JSON.parse(readFileSync(resolve(privateRoot,'data',n),'utf8'))]));
    const pack=compileClassicalChinese(files);
    expect(pack.items.filter(i=>i.mode==='sound-recognition')).toHaveLength(56);
    expect(pack.items.filter(i=>i.mode==='dictation')).toHaveLength(54);
    expect(pack.items.filter(i=>i.id.startsWith('sound-final-')).every(i=>i.audioId && !i.showPinyin)).toBe(true);
    expect(pack.items.filter(i => i.mode==='radical-identity')).toHaveLength(57);expect(pack.items.filter(i=>i.mode==='radical-writing')).toHaveLength(99);
    for(const [glyph,radical] of [['海','水'],['想','心'],['朗','月'],['陸','阜']])expect(pack.items.find(i=>i.mode==='radical-writing' && i.referenceGlyph===glyph)?.answers).toContain(radical);
    expect(pack.items.find(i=>i.mode==='radical-writing' && i.referenceGlyph==='陸')?.reveal).toContain('left-side');
    expect(pack.items.filter(i=>i.kind==='choice' && ['老','考'].includes(i.glyph || '')).every(i=>i.answers[0]==='Evolving and deriving' && i.reveal.includes('老 and 考'))).toBe(true);
    // Hash verification of all audio is also exercised through the importer in the private browser suite.
    expect(pack.items.find(i=>i.id==='dictation-ong')?.audioId).toBeUndefined();
    expect(pack.items.find(i=>i.kind==='choice' && i.glyph==='修行')?.answers).toHaveLength(2);
  });
});
