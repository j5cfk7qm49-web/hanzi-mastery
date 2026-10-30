import { gunzipSync, strFromU8 } from 'fflate';
import { convert } from 'pinyin-pro';
import { characters, type DictionaryProvenance } from '../core/schema';
import { parsePinyin, pinyinKey, validateReading } from '../core/recall';
import { dictionaryWordUrl } from '../core/dictionaryLinks';
import { fetchWithTimeout } from './http';

export const CEDICT_SNAPSHOT = '2026-10-17T16:45:37Z / sha256:2680af828c0d949b544c9399b4dc8503788c99150ab73887600fed6b4f880b26';
export interface EnglishEntry { traditional: string; simplified: string; pinyin: string; definitions: string[] }
export interface DictionaryCandidate {
  traditional: string; simplified?: string; pinyin: string; meanings: string[]; dictionary: DictionaryProvenance;
}
export interface DictionaryLookup { word: string; candidates: DictionaryCandidate[]; error?: string }
export function importWords(text: string): string[] {
  const words = [...new Set(text.split(/[\s,，;；]+/u).filter(Boolean))];
  if (!words.length) throw new Error('Enter Traditional characters or words, separated by spaces or new lines.');
  words.forEach(characters); return words;
}
export function findEnglishEntries(text: string, words: string[]): Map<string, EnglishEntry[]> {
  const wanted = new Set(words), result = new Map<string, EnglishEntry[]>();
  for (const line of text.split(/\r?\n/)) {
    if (!wanted.has(line.slice(0, line.indexOf(' ')))) continue;
    const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.*)\/$/u);
    if (!match) continue;
    const entry = { traditional: match[1], simplified: match[2], pinyin: match[3], definitions: match[4].split('/').filter(Boolean) };
    try { validateReading(entry); } catch { continue; }
    result.set(entry.traditional, [...result.get(entry.traditional) || [], entry]);
  }
  return result;
}
/** Editable study glosses are separate from the complete, unchanged source definitions. */
export function studyMeanings(definitions: string[]): string[] {
  return definitions.filter(text => !/^(CL:|variant of |old variant of |see |also written |Taiwan pr\.)/i.test(text))
    .map(text => text.replace(/\p{Script=Han}+/gu, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
}
export function dictionaryCandidates(word: string, english: EnglishEntry[], at = new Date().toISOString()): DictionaryCandidate[] {
  characters(word);
  const groups = new Map<string, EnglishEntry[]>();
  for (const entry of english) {
    if (entry.traditional !== word) continue;
    try {
      validateReading(entry);
      const key = pinyinKey(parsePinyin(entry.pinyin));
      groups.set(key, [...groups.get(key) || [], entry]);
    } catch { /* An unsupported source reading cannot become a study answer. */ }
  }
  const candidates: DictionaryCandidate[] = [];
  for (const [key, matches] of groups) {
    const originals = [...new Set(matches.flatMap(item => item.definitions))];
    const pinyin = convert(key);
    const dictionary: DictionaryProvenance = { importedAt: at, english: { provider: 'CC-CEDICT', url: dictionaryWordUrl(word),
      snapshot: CEDICT_SNAPSHOT, pinyin: matches.map(item => item.pinyin).join(' / '), definitions: originals, license: 'CC BY-SA 4.0' } };
    const simplified = [...new Set(matches.map(item => item.simplified))];
    candidates.push({ traditional: word, pinyin, ...(simplified.length === 1 ? { simplified: simplified[0] } : {}),
      meanings: studyMeanings(originals), dictionary });
  }
  if (!candidates.length) throw new Error('No supported CC-CEDICT entry was found for this Traditional form. Add this word manually.');
  return candidates;
}
const englishLoads = new Map<string, Promise<string>>();
async function englishSource(rootURL: string): Promise<string> {
  let pending = englishLoads.get(rootURL);
  if (!pending) {
    pending = (async () => {
      const buffer = await fetchWithTimeout(new URL('dictionary/cedict.txt.gz', rootURL.endsWith('/') ? rootURL : rootURL + '/').href, async response => {
        if (!response.ok) throw new Error('The bundled CC-CEDICT snapshot could not load. Reopen the workbench and retry.');
        return response.arrayBuffer();
      });
      const data = new Uint8Array(buffer);
      if (data.length > 8 * 1024 * 1024) throw new Error('Unexpected dictionary size.');
      return strFromU8(gunzipSync(data));
    })();
    englishLoads.set(rootURL, pending);
    void pending.catch(() => { if (englishLoads.get(rootURL) === pending) englishLoads.delete(rootURL); });
  }
  return pending;
}
export interface DictionaryLookupOptions {
  signal?: AbortSignal;
  onResult?(result: DictionaryLookup, completed: number, total: number): void;
}
async function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw new DOMException('Lookup stopped.', 'AbortError');
  return new Promise<T>((resolve, reject) => {
    const cancel = () => reject(new DOMException('Lookup stopped.', 'AbortError'));
    signal.addEventListener('abort', cancel, { once: true });
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}
export async function lookupDictionary(words: string[], rootURL: string, options: DictionaryLookupOptions = {}): Promise<DictionaryLookup[]> {
  const english = findEnglishEntries(await abortable(englishSource(rootURL), options.signal), words), results: DictionaryLookup[] = [];
  // No word-count ceiling. Small batches keep progress responsive; requests remain sequential.
  for (let start = 0; start < words.length; start += 25) {
    for (const word of words.slice(start, start + 25)) {
      if (options.signal?.aborted) return results;
      let result: DictionaryLookup;
      try {
        result = { word, candidates: dictionaryCandidates(word, english.get(word) || []) };
      } catch (error) {
        if (options.signal?.aborted) return results;
        result = { word, candidates: [], error: error instanceof Error ? error.message : 'Dictionary lookup failed.' };
      }
      results.push(result); options.onResult?.(result, results.length, words.length);
    }
    if (start + 25 < words.length) await new Promise(resolve => setTimeout(resolve, 0));
  }
  return results;
}
