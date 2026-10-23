import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { dictionaryCandidates, findEnglishEntries, importWords, lookupDictionary, studyMeanings } from '../src/services/dictionary';
afterEach(() => vi.unstubAllGlobals());
const english = findEnglishEntries('學 学 [xue2] /to study/to learn/\n行 行 [hang2] /row/\n行 行 [xing2] /to walk/\n垃圾 垃圾 [la1 ji1] /rubbish/Taiwan pr. [le4 se4]/', ['學', '行', '垃圾']);
const moe = { title: '學', heteronyms: [{ pinyin: 'xué', bopomofo: 'ㄒㄩㄝˊ', definitions: [{ def: '研習、學習。' }] }] };
it('accepts and deduplicates explicit Traditional word lists while refusing unsupported input', () => {
  expect(importWords('學\n學 中國，朋友')).toEqual(['學', '中國', '朋友']);
  expect(() => importWords('hello')).toThrow(); expect(() => importWords('')).toThrow();
  expect(importWords(Array.from({ length: 251 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join('\n'))).toHaveLength(251);
});
it('sources the reading from MOE, matches English by reading and retains separate original sources', () => {
  const [candidate] = dictionaryCandidates('學', moe, english.get('學')!, '2026-10-21T00:00:00Z');
  expect(candidate).toMatchObject({ traditional: '學', simplified: '学', pinyin: 'xué', meanings: ['to study', 'to learn'] });
  expect(candidate.dictionary).toMatchObject({ importedAt: '2026-10-21T00:00:00Z', moe: { pinyin: 'xué', definitions: ['研習、學習。'] }, english: { definitions: ['to study', 'to learn'] } });
  const candidates = dictionaryCandidates('行', { title: '行', heteronyms: [
    { pinyin: 'háng', definitions: [{ def: '行列。' }] }, { pinyin: 'xíng', definitions: [{ def: '行走。' }] },
  ] }, english.get('行')!);
  expect(candidates.map(c => c.meanings)).toEqual([['row'], ['to walk']]);
});
it('uses explicit Taiwan pronunciation annotations without replacing them with a generated reading', () => {
  const [candidate] = dictionaryCandidates('垃圾', { title: '垃圾', heteronyms: [{ pinyin: 'lè sè', definitions: [{ def: '廢棄物。' }] }] }, english.get('垃圾')!);
  expect(candidate.pinyin).toBe('lè sè'); expect(candidate.meanings).toEqual(['rubbish']);
  expect(candidate.dictionary.english?.pinyin).toBe('la1 ji1');
});
it('does not attach a different reading’s English definitions or guess an absent dictionary entry', () => {
  const [candidate] = dictionaryCandidates('行', { title: '行', heteronyms: [{ pinyin: 'hàng', definitions: [{ def: '測試。' }] }] }, english.get('行')!);
  expect(candidate.meanings).toEqual([]); expect(candidate.dictionary.english).toBeUndefined();
  expect(() => dictionaryCandidates('學', { ...moe, title: '学' }, [])).toThrow('exact MOE');
  expect(() => dictionaryCandidates('學', { title: '學', heteronyms: [{ pinyin: 'invalid text', definitions: [] }] }, [])).toThrow('no supported reading');
  expect(studyMeanings(['CL:個|个[ge4]', 'variant of 學[xue2]', 'to study', 'surname 學'])).toEqual(['to study', 'surname']);
});
it('queries the bundled real snapshot and live-source adapter separately, isolating failed words', async () => {
  const data = readFileSync('public/dictionary/cedict.txt.gz');
  const source = strFromU8(gunzipSync(data));
  expect(findEnglishEntries(source, ['學習']).get('學習')?.some(entry => entry.definitions.some(definition => definition.includes('to study')))).toBe(true);
  const fetcher = vi.fn(async (url: string) => url.includes('cedict.txt.gz') ? new Response(data) :
    url.endsWith(encodeURIComponent('學')) ? new Response(JSON.stringify(moe), { headers: { 'content-type': 'application/json' } }) : new Response('', { status: 404 }));
  vi.stubGlobal('fetch', fetcher);
  const results = await lookupDictionary(['學', '不存在'], 'https://plugin.example/');
  expect(results[0].candidates[0].pinyin).toBe('xué');
  expect(results[1].error).toContain('404');
  expect(fetcher.mock.calls.map(call => call[0])).toEqual(['https://plugin.example/dictionary/cedict.txt.gz',
    `https://www.moedict.tw/uni/${encodeURIComponent('學')}`, `https://www.moedict.tw/uni/${encodeURIComponent('不存在')}`]);
});
it('streams progress beyond 50 words, stops before another request, and can resume remaining words', async () => {
  const words=Array.from({length:61},(_,i)=>String.fromCodePoint(0x4e00+i)), controller=new AbortController();
  const fetcher=vi.fn(async(url:string)=>url.includes('cedict.txt.gz')?new Response(gzipSync(strToU8(''))):
    new Response(JSON.stringify({title:decodeURIComponent(url.split('/').at(-1)!),heteronyms:[{pinyin:'rén',definitions:[{def:'測試。'}]}]})));
  vi.stubGlobal('fetch',fetcher);
  const progress:number[]=[];
  const first=await lookupDictionary(words,'https://batch.example/',{signal:controller.signal,onResult:(_r,count,total)=>{
    progress.push(count); expect(total).toBe(61); if(count===27) controller.abort();
  }});
  expect(first).toHaveLength(27); expect(progress).toEqual(Array.from({length:27},(_,i)=>i+1));
  expect(fetcher).toHaveBeenCalledTimes(28);
  const rest=await lookupDictionary(words.slice(first.length),'https://batch.example/');
  expect(rest).toHaveLength(34); expect(fetcher).toHaveBeenCalledTimes(62);
});
