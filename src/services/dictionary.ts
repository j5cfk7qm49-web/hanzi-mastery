import { gunzipSync, strFromU8 } from 'fflate';
import { convert } from 'pinyin-pro';
import { characters, type DictionaryProvenance } from '../core/schema';
import { parsePinyin, pinyinKey, validateReading } from '../core/recall';

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
function readingKey(text: string): string | undefined { try { return pinyinKey(parsePinyin(text)); } catch { return undefined; } }
function matchesReading(entry: EnglishEntry, key: string): boolean {
  if (readingKey(entry.pinyin) === key) return true;
  return entry.definitions.some(definition => [...definition.matchAll(/Taiwan pr\.\s*\[([^\]]+)\]/g)].some(match => readingKey(match[1]) === key));
}
/** Editable study glosses are separate from the complete, unchanged source definitions. */
export function studyMeanings(definitions: string[]): string[] {
  return definitions.filter(text => !/^(CL:|variant of |old variant of |see |also written |Taiwan pr\.)/i.test(text))
    .map(text => text.replace(/\p{Script=Han}+/gu, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
}
export function dictionaryCandidates(word: string, raw: unknown, english: EnglishEntry[], at = new Date().toISOString()): DictionaryCandidate[] {
  if (!raw || typeof raw !== 'object') throw new Error('The dictionary returned invalid data.');
  const entry = raw as { title?: unknown; heteronyms?: unknown };
  if (entry.title !== word || !Array.isArray(entry.heteronyms)) throw new Error('No exact MOE dictionary entry was returned. Use a Traditional headword or add it manually.');
  const candidates: DictionaryCandidate[] = [], seen = new Set<string>();
  for (const heteronym of entry.heteronyms) {
    if (!heteronym || typeof heteronym.pinyin !== 'string' || !Array.isArray(heteronym.definitions)) continue;
    try { validateReading({ traditional: word, pinyin: heteronym.pinyin }); } catch { continue; }
    const key = readingKey(heteronym.pinyin)!;
    if (seen.has(key)) continue;
    seen.add(key);
    const matches = english.filter(item => matchesReading(item, key));
    const originals = [...new Set(matches.flatMap(item => item.definitions))];
    const definitions = heteronym.definitions.flatMap((definition: { def?: unknown }) => typeof definition?.def === 'string' ? [definition.def] : []);
    const pinyin = convert(pinyinKey(parsePinyin(heteronym.pinyin)));
    const dictionary: DictionaryProvenance = { importedAt: at, moe: { provider: 'MOE Revised via Moedict',
      url: `https://www.moedict.tw/uni/${encodeURIComponent(word)}`, pinyin: heteronym.pinyin,
      bopomofo: typeof heteronym.bopomofo === 'string' ? heteronym.bopomofo : '', definitions,
      license: 'CC BY-ND 3.0 TW', edition: 'Live Moedict mirror; source edition not reported by API' },
      ...(matches.length ? { english: { provider: 'CC-CEDICT' as const, url: 'https://www.mdbg.net/chinese/dictionary?page=cedict',
        snapshot: CEDICT_SNAPSHOT, pinyin: matches.map(item => item.pinyin).join(' / '), definitions: originals, license: 'CC BY-SA 4.0' as const } } : {}) };
    const simplified = [...new Set(matches.map(item => item.simplified))];
    candidates.push({ traditional: word, pinyin, ...(simplified.length === 1 ? { simplified: simplified[0] } : {}),
      meanings: studyMeanings(originals), dictionary });
  }
  if (!candidates.length) throw new Error('The MOE entry has no supported reading with one pinyin syllable per character. Add this item manually.');
  return candidates;
}
const englishLoads = new Map<string, Promise<string>>();
async function fetchWithTimeout<T>(url: string, consume: (response: Response) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', cancel, { once: true });
  try { return await consume(await fetch(url, { signal: controller.signal, credentials: 'omit' })); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
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
        const raw = await fetchWithTimeout(`https://www.moedict.tw/uni/${encodeURIComponent(word)}`, async response => {
          if (!response.ok) throw new Error(`MOE lookup unavailable (${response.status}). Retry or add this entry manually.`);
          return response.json() as Promise<unknown>;
        }, options.signal);
        result = { word, candidates: dictionaryCandidates(word, raw, english.get(word) || []) };
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
