import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { dictionaryCandidates, findEnglishEntries, importWords, lookupDictionary, studyMeanings } from '../src/services/dictionary';
import { dictionaryWordUrl } from '../src/core/dictionaryLinks';
afterEach(() => vi.unstubAllGlobals());
const english = findEnglishEntries('學 学 [xue2] /to study/to learn/\n行 行 [hang2] /row/\n行 行 [xing2] /to walk/\n垃圾 垃圾 [la1 ji1] /rubbish/Taiwan pr. [le4 se4]/', ['學', '行', '垃圾']);
it('accepts and deduplicates explicit Traditional word lists while refusing unsupported input', () => {
  expect(importWords('學\n學 中國，朋友')).toEqual(['學', '中國', '朋友']);
  expect(() => importWords('hello')).toThrow(); expect(() => importWords('')).toThrow();
  expect(importWords(Array.from({ length: 251 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join('\n'))).toHaveLength(251);
});
it('uses CC-CEDICT reading-specific English and generates a link for the imported word', () => {
  const [candidate] = dictionaryCandidates('學', english.get('學')!, '2026-10-23T00:00:00Z');
  expect(candidate).toMatchObject({ traditional: '學', simplified: '学', pinyin: 'xué', meanings: ['to study', 'to learn'] });
  expect(candidate.dictionary).toMatchObject({ importedAt: '2026-10-23T00:00:00Z', english: {
    url: dictionaryWordUrl('學'), pinyin: 'xue2', definitions: ['to study', 'to learn'], license: 'CC BY-SA 4.0',
  } });
  expect(candidate.dictionary.moe).toBeUndefined();
  expect(dictionaryCandidates('行', english.get('行')!).map(c => [c.pinyin,c.meanings])).toEqual([['háng',['row']],['xíng',['to walk']]]);
});
it('keeps regional notes as original source data while defaulting to the actual CC-CEDICT reading', () => {
  const [candidate] = dictionaryCandidates('垃圾', english.get('垃圾')!);
  expect(candidate.pinyin).toBe('lā jī'); expect(candidate.meanings).toEqual(['rubbish']);
  expect(candidate.dictionary.english?.definitions).toContain('Taiwan pr. [le4 se4]');
});
it('rejects absent or mismatched entries without fabricating a reading', () => {
  expect(() => dictionaryCandidates('學', english.get('行')!)).toThrow('CC-CEDICT');
  expect(() => dictionaryCandidates('學', [{ traditional:'學', simplified:'学', pinyin:'invalid text', definitions:['test'] }])).toThrow();
  expect(studyMeanings(['CL:個|个[ge4]', 'variant of 學[xue2]', 'to study', 'surname 學'])).toEqual(['to study', 'surname']);
});
it('looks up the real bundled dictionary without any external dictionary request', async () => {
  const data = readFileSync('public/dictionary/cedict.txt.gz');
  expect(findEnglishEntries(strFromU8(gunzipSync(data)), ['學習']).get('學習')?.some(entry => entry.definitions.some(definition => definition.includes('to study')))).toBe(true);
  const fetcher = vi.fn(async () => new Response(data)); vi.stubGlobal('fetch', fetcher);
  const results = await lookupDictionary(['學', '不存在不存在'], 'https://dictionary-default.example/');
  expect(results[0].candidates.some(candidate => candidate.pinyin === 'xué')).toBe(true);
  expect(results[1].error).toContain('CC-CEDICT');
  expect(fetcher.mock.calls).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledWith('https://dictionary-default.example/dictionary/cedict.txt.gz', expect.any(Object));
});
it('streams local progress beyond 50 words and resumes without refetching the dictionary', async () => {
  const words=Array.from({length:61},(_,i)=>String.fromCodePoint(0x4e00+i)), controller=new AbortController();
  const data=gzipSync(strToU8(words.map(word=>`${word} ${word} [ren2] /person/`).join('\n')));
  const fetcher=vi.fn(async()=>new Response(data)); vi.stubGlobal('fetch',fetcher);
  const progress:number[]=[];
  const first=await lookupDictionary(words,'https://dictionary-batch.example/',{signal:controller.signal,onResult:(_r,count,total)=>{
    progress.push(count); expect(total).toBe(61); if(count===27) controller.abort();
  }});
  expect(first).toHaveLength(27); expect(progress).toHaveLength(27); expect(fetcher).toHaveBeenCalledTimes(1);
  const rest=await lookupDictionary(words.slice(first.length),'https://dictionary-batch.example/');
  expect(rest).toHaveLength(34); expect(fetcher).toHaveBeenCalledTimes(1);
});
