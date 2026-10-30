import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { gzipSync, strToU8, gunzipSync, strFromU8 } from 'fflate';
import { findRecording, shtookaRecording, mandarinFiles } from '../src/services/recordings';
import { recordingMatches } from '../src/core/recordings';
import { moeRecording } from '../src/services/moeRecordings';
import { importDictionaryCandidate, updateVocabulary, readVocabulary } from '../src/services/vocabulary';
import { readStudyCards } from '../src/services/cards';
import { memoryRemNote } from './helpers/remnote-memory';
import { dictionaryCandidates, findEnglishEntries } from '../src/services/dictionary';

afterEach(() => vi.unstubAllGlobals());
const word = { traditional:'學習', simplified:'学习', pinyin:'xué xí' };
const source = shtookaRecording([['学习','xuéxí','cmn-1234abcd']],word)!;
it('requires both an explicit matching form and reading instead of guessing an opaque recording ID', () => {
  expect(source.url).toContain('ogg/cmn-1234abcd.ogg'); expect(recordingMatches(source,word)).toBe(true);
  expect(shtookaRecording([['学习','xuéxí','cmn-1234abcd']],{...word,pinyin:'xué xì'})).toBeUndefined();
  expect(shtookaRecording([['学期','xuéxí','cmn-1234abcd']],word)).toBeUndefined();
  expect(shtookaRecording([['学习','xuéxí','../../bad']],word)).toBeUndefined();
});
it('uses the compact real index with matching metadata and downloads no recording', async () => {
  const bytes=readFileSync('public/audio/shtooka-index.json.gz');
  const data=JSON.parse(strFromU8(gunzipSync(bytes)));
  expect(bytes.length).toBeLessThan(160*1024); expect(data.records.length).toBe(8569);
  const fetcher=vi.fn(async(_url:string)=>new Response(bytes)); vi.stubGlobal('fetch',fetcher);
  const recording=await findRecording({traditional:'安全',pinyin:'ān quán'},'https://recording-index.example/');
  expect(recording?.url).toContain('cmn-99dda64b.ogg');
  await findRecording({traditional:'安全',pinyin:'ān quán'},'https://recording-index.example/');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toContain('shtooka-index.json.gz');
});
it('shares base-radical recordings without changing targets or guessing a different reading', () => {
  const target={traditional:'忄',pinyin:'xīn'};
  const recording=shtookaRecording([['心','xīn','cmn-1234abcd']],target)!;
  expect(recording).toMatchObject({traditional:'忄',pinyin:'xīn',recordedForm:'心'});
  expect(recordingMatches(recording,target)).toBe(true);
  expect(shtookaRecording([['心','xīn','cmn-1234abcd']],{...target,pinyin:'xìn'})).toBeUndefined();
  expect(shtookaRecording([['廣','guǎng','cmn-1234abcd']],{traditional:'广',pinyin:'yǎn'})).toBeUndefined();
  const sides:[string,string,string][]=[['阜','fù','cmn-1111'],['邑','yì','cmn-2222']];
  expect(shtookaRecording(sides,{traditional:'阝',pinyin:'fù'})?.recordedForm).toBe('阜');
  expect(shtookaRecording(sides,{traditional:'阝',pinyin:'yì'})?.recordedForm).toBe('邑');
  expect(shtookaRecording([['糸','mì','cmn-1234abcd']],{traditional:'糹',pinyin:'sī'})).toBeUndefined();
});
it('uses an intact matching single syllable without changing the target or assembling word audio', () => {
  const rows:[string,string,string][]=[['鹿','lù','cmn-1234abcd']];
  expect(shtookaRecording(rows,{traditional:'陸',pinyin:'lù'})).toMatchObject({traditional:'陸',pinyin:'lù',recordedForm:'鹿'});
  expect(shtookaRecording(rows,{traditional:'陸',pinyin:'liù'})).toBeUndefined();
  expect(shtookaRecording(rows,{traditional:'陸陸',pinyin:'lù lù'})).toBeUndefined();
  expect(shtookaRecording([['道路','lù','cmn-1234abcd']],{traditional:'陸',pinyin:'lù'})).toBeUndefined();
});
it('uses the official MOE word-audio endpoint with exact tones, credits and real compact metadata', () => {
  const bytes=readFileSync('public/audio/moe-index.json.gz');
  const index=JSON.parse(strFromU8(gunzipSync(bytes)));
  expect(bytes.length).toBeLessThan(48*1024); expect(index.records).toHaveLength(6472);
  for(const target of [{traditional:'疒',pinyin:'nè'},{traditional:'辶',pinyin:'chuò'},{traditional:'⺮',pinyin:'zhú'},{traditional:'耳',pinyin:'ěr'},{traditional:'彳',pinyin:'chì'}]) {
    const recording=moeRecording(index.records,target)!;
    expect(recording.provider).toBe('MOE Concise');
    expect(recording.url).toMatch(/^https:\/\/dict\.concised\.moe\.edu\.tw\/sound\/word\/\d{4}[A-Z]?\.mp3$/);
    expect(recording.license).toBe('CC BY-ND 3.0 TW');
    expect(recording.author).not.toMatch(/\p{Script=Han}/u); // Study credits must not reveal answer characters.
    expect(recordingMatches(recording,target)).toBe(true);
  }
  expect(moeRecording([['耳','ěr','5829']],{traditional:'耳',pinyin:'èr'})).toBeUndefined();
  expect(moeRecording(index.records,{traditional:'竹子',pinyin:'zhú zi'})).toBeUndefined();
  expect(moeRecording([['耳','ěr','../mean/5829']],{traditional:'耳',pinyin:'ěr'})).toBeUndefined();
});
it('still attaches MOE audio when external Wikimedia lookup is unavailable', async () => {
  vi.resetModules();
  const {findRecording:isolatedFind}=await import('../src/services/recordings');
  const fetcher=vi.fn(async(url:string)=>{
    if(url.includes('shtooka-index')) return new Response(gzipSync(strToU8(JSON.stringify({version:1,records:[]}))));
    if(url.includes('moe-index')) return new Response(readFileSync('public/audio/moe-index.json.gz'));
    return new Response('Unavailable',{status:503,headers:{'Retry-After':'120'}});
  });vi.stubGlobal('fetch',fetcher);
  const recording=await isolatedFind({traditional:'耳',pinyin:'ěr'},'https://moe-fallback.example/');
  expect(recording).toMatchObject({provider:'MOE Concise',url:'https://dict.concised.moe.edu.tw/sound/word/5829.mp3',recordedForm:'耳'});
  expect(fetcher.mock.calls.some(([url])=>url.startsWith('https://dict.concised.moe.edu.tw'))).toBe(false); // Audio is not fetched on import.
  const external=()=>fetcher.mock.calls.filter(([url])=>url.includes('en.wiktionary.org')).length;
  expect(external()).toBe(1);
  const clock=vi.spyOn(Date,'now').mockReturnValue(Date.now()+31000);
  try {
    expect((await isolatedFind({traditional:'耳',pinyin:'ěr'},'https://moe-fallback.example/'))?.provider).toBe('MOE Concise');
    expect(external()).toBe(1); // Honour the upstream cooldown while keeping MOE usable.
  } finally { clock.mockRestore(); }
});
it('selects Mandarin audio only and refuses ambiguous regional templates or other readings', () => {
  const text='==Chinese==\n{{zh-pron\n|m=xuéxí\n|ma=y\n|c=hok6 zaap6\n|ca=Cantonese.wav\n}}\n==Japanese==\n{{zh-pron|m=xuéxí|ma=Wrong.wav}}';
  expect(mandarinFiles(text,['Zh-xuéxí.ogg','Cantonese.wav','Wrong.wav'],word)).toEqual(['Zh-xuéxí.ogg']);
  expect(mandarinFiles(text,['zh-xuéxí.ogg'],word)).toEqual(['zh-xuéxí.ogg']);
  expect(mandarinFiles(text,['zh-Xuéxí.ogg'],word)).toEqual([]); // Only the first character is case-insensitive.
  expect(mandarinFiles('==Chinese==\n{{zh-pron|m=xuéxí|ma=Zh study.ogg}}',['zh_study.ogg'],word)).toEqual(['zh_study.ogg']);
  expect(mandarinFiles('==Chinese==\n{{zh-pron|m=xuéxí<!--old reading-->|mn_note={{zh-l|word|tr=other}} and [[link|label]]|ma=y}}',['zh-xuéxí.ogg'],word)).toEqual(['zh-xuéxí.ogg']);
  expect(mandarinFiles('==Chinese==\n{{zh-pron|m=xuéxí|mn_note={{example|ma=Wrong.wav}}}}',['Wrong.wav'],word)).toEqual([]);
  expect(mandarinFiles(text,['Zh-xuéxí.ogg'],{...word,pinyin:'xué xì'})).toEqual([]);
  expect(mandarinFiles('==Chinese==\n{{zh-pron|m=垃圾|ca=Cantonese.wav}}',['Cantonese.wav'],{traditional:'垃圾',pinyin:'lā jī'})).toEqual([]);
});
it('resolves a matching Commons file dynamically, preserving credits and preferring its MP3 derivative', async () => {
  const fetcher=vi.fn(async(url:string)=>{
    if(url.includes('shtooka-index')) return new Response(gzipSync(strToU8(JSON.stringify({version:1,records:[]}))));
    if(url.includes('en.wiktionary.org')) return new Response(JSON.stringify({parse:{title:'學習',wikitext:'==Chinese==\n{{zh-pron|m=xuéxí|ma=y}}',images:['zh-xuéxí.ogg']}}));
    return new Response(JSON.stringify({query:{pages:[{title:'File:Zh-xuéxí.ogg',videoinfo:[{
      url:'https://upload.wikimedia.org/original.ogg',derivatives:[{type:'audio/mpeg',src:'https://upload.wikimedia.org/recording.mp3'}],
      extmetadata:{Artist:{value:'<a href="https://example.com">Native speaker</a>'},LicenseShortName:{value:'CC BY 2.0 fr'},LicenseUrl:{value:'http://creativecommons.org/licenses/by/2.0/fr/'}},
    }]}]}}));
  }); vi.stubGlobal('fetch',fetcher);
  const recording=await findRecording(word,'https://commons-fallback.example/');
  expect(recording).toMatchObject({url:'https://upload.wikimedia.org/recording.mp3',author:'Native speaker',license:'CC BY 2.0 fr',pinyin:'xué xí'});
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls.every(([url])=>!url.startsWith('https://upload.wikimedia.org'))).toBe(true);
});
it('resolves a base radical through Commons while retaining the variant as the saved target', async () => {
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(url.includes('shtooka-index')) return new Response(gzipSync(strToU8(JSON.stringify({version:1,records:[]}))));
    if(url.includes('en.wiktionary.org')) {
      const form=new URL(url).searchParams.get('page');
      return new Response(JSON.stringify({parse:{title:form,wikitext:form==='衣'?'==Chinese==\n{{zh-pron|m=yī|ma=y}}':'==Chinese==\nNo recording',images:form==='衣'?['zh-yī.ogg']:[]}}));
    }
    return new Response(JSON.stringify({query:{pages:[{title:'File:Zh-yī.ogg',videoinfo:[{
      url:'https://upload.wikimedia.org/yi.ogg',extmetadata:{Artist:{value:'Native speaker'},LicenseShortName:{value:'CC BY 2.0 fr'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/2.0/fr/'}},
    }]}]}}));
  }));
  const target={traditional:'衤',pinyin:'yī'};
  const recording=await findRecording(target,'https://radical-commons.example/');
  expect(recording).toMatchObject({traditional:'衤',recordedForm:'衣',pinyin:'yī'});
  expect(recordingMatches(recording,target)).toBe(true);
});
it('links imported recordings to cards and clears generated audio on a reading edit while preserving custom overrides', async () => {
  const a=memoryRemNote(); a.plugin.rootURL='https://import-recording.example/';
  const fetcher=vi.fn(async()=>new Response(gzipSync(strToU8(JSON.stringify({version:1,records:[['学习','xuéxí','cmn-1234abcd']]})))));
  vi.stubGlobal('fetch',fetcher);
  const [candidate]=dictionaryCandidates('學習',findEnglishEntries('學習 学习 [xue2 xi2] /to study/',['學習']).get('學習')!);
  const saved=await importDictionaryCandidate(a.plugin,candidate,{skills:['listening','pronunciation'],findAudio:true});
  expect(saved.vocabulary.audioSource).toEqual(source);
  const cards=await readStudyCards(a.plugin,saved.id);
  expect(cards.every(card=>card.schema.skill!=='writing'&&card.schema.audioSource?.url===source.url)).toBe(true);
  const custom=cards[0];
  await updateVocabulary(a.plugin,saved.id,saved.vocabulary,{[custom.id]:{audio:'https://example.com/my-recording.mp3'}});
  await updateVocabulary(a.plugin,saved.id,{...saved.vocabulary,pinyin:'xué xì'});
  expect((await readVocabulary(a.plugin,saved.id)).audio).toEqual([]);
  const edited=await readStudyCards(a.plugin,saved.id);
  expect(edited.find(card=>card.id===custom.id)?.schema).toMatchObject({referenceAudio:'https://example.com/my-recording.mp3',customAudio:true});
  expect(edited.filter(card=>card.id!==custom.id).every(card=>card.schema.skill!=='writing'&&!card.schema.referenceAudio&&!card.schema.audioSource)).toBe(true);
});
it('keeps a word import successful if optional recording services are unavailable', async () => {
  const a=memoryRemNote(); a.plugin.rootURL='https://recording-failure.example/';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('Unavailable',{status:503})));
  const [candidate]=dictionaryCandidates('學習',findEnglishEntries('學習 学习 [xue2 xi2] /to study/',['學習']).get('學習')!);
  const saved=await importDictionaryCandidate(a.plugin,candidate,{skills:[],findAudio:true});
  expect(saved.audioNotice).toContain('unavailable');
  expect((await readVocabulary(a.plugin,saved.id)).meanings).toEqual(['to study']);
  expect(saved.vocabulary.audio).toBeUndefined();
});
