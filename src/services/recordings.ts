import { characters, type RecordingSource } from '../core/schema';
import { validateReading } from '../core/pinyin';
import { recordingMatches } from '../core/recordings';
import { fetchWithTimeout } from './http';
import { compactReading, desiredReading, recordingForms, loadRecordingIndex, matchRecordingRow, type RecordingWord as Word, type RecordingRow as IndexRow } from './recordingIndex';
import { findMoeRecording } from './moeRecordings';
export { compactReading } from './recordingIndex';

const root = 'https://fsi-languages.yojik.eu/audiocollections/detailled/cmn-caen-tan/';
let unavailableUntil = 0;
// MediaWiki treats underscores as spaces and the first filename character as uppercase.
const fileKey = (name: string) => name.replace(/_/g, ' ').normalize('NFC').replace(/^./u, first => first.toUpperCase());
export function shtookaRecording(rows: IndexRow[], word: Word): RecordingSource | undefined {
  const row = matchRecordingRow(rows, word, /^cmn-[a-f0-9]+$/);
  return row ? { provider: 'Shtooka', url: `${root}ogg/${row[2]}.ogg`, sourceUrl: `${root}readme.txt`,
    author: 'Yue Tan (2009), University of Caen / Shtooka', license: 'CC BY-SA 3.0 US',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/us/', traditional: word.traditional, pinyin: word.pinyin, recordedForm: row[0] } : undefined;
}
/** Split only outer template fields; nested dialect notes must not hide or inject Mandarin fields. */
function pronunciationFields(section: string): Map<string, string>[] {
  const result: Map<string, string>[] = [];
  for (const match of section.matchAll(/\{\{zh-pron(?=[\s|}])/g)) {
    let depth = 1, links = 0, start = match.index! + match[0].length;
    const fields: string[] = [];
    for (let i = start; i < section.length; i++) {
      const pair = section.slice(i, i + 2);
      if (pair === '{{') { depth++; i++; }
      else if (pair === '}}') {
        depth--;
        if (!depth) {
          fields.push(section.slice(start, i));
          result.push(new Map(fields.flatMap(field => {
            const equal = field.indexOf('=');
            return equal < 0 ? [] : [[field.slice(0, equal).trim(), field.slice(equal + 1).trim()]];
          })));
          break;
        }
        i++;
      } else if (pair === '[[') { links++; i++; }
      else if (pair === ']]') { links = Math.max(0, links - 1); i++; }
      else if (section[i] === '|' && depth === 1 && !links) { fields.push(section.slice(start, i)); start = i + 1; }
    }
  }
  return result;
}
/** Only Mandarin audio from a Chinese pronunciation template with an exact reading. */
export function mandarinFiles(wikitext: string, images: string[], word: Word): string[] {
  const section = wikitext.replace(/<!--[\s\S]*?-->/g, '').match(/^==\s*Chinese\s*==\s*\n([\s\S]*?)(?=^==[^=]|$(?![\s\S]))/m)?.[1];
  if (!section) return [];
  const result: string[] = [];
  for (const fields of pronunciationFields(section)) {
    const pronunciation = fields.get('m')?.split(',')[0].trim();
    if (!pronunciation || compactReading(pronunciation) !== desiredReading(word)) continue;
    const audio = fields.get('ma');
    const names = audio === 'y' ? [
      `Zh-${pronunciation}.ogg`,
      `Zh-${pronunciation.normalize('NFD').replace(/\u0304/g, '').normalize('NFC')}.ogg`,
    ] : audio ? [audio] : [];
    for (const name of names) {
      if (!/^[^/\\|{}<>\n]+\.(?:ogg|oga|wav|mp3)$/i.test(name)) continue;
      const available = images.find(image => typeof image === 'string' && fileKey(image) === fileKey(name));
      if (available) result.push(available);
    }
  }
  return [...new Set(result)];
}
const wikiURL = (host: string, params: Record<string, string>) => `https://${host}/w/api.php?${new URLSearchParams({
  format: 'json', formatversion: '2', origin: '*', ...params,
})}`;
async function json(url: string): Promise<any> {
  return fetchWithTimeout(url, async response => {
    if (!response.ok) {
      const retry = response.headers.get('Retry-After');
      if (retry && (response.status === 429 || response.status === 503)) {
        const retryAt = /^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry);
        if (Number.isFinite(retryAt)) unavailableUntil = Math.max(unavailableUntil, retryAt);
      }
      throw new Error('Recording lookup unavailable.');
    }
    const text = await response.text();
    if (text.length > 1024 * 1024) throw new Error('Unexpected recording response size.');
    return JSON.parse(text);
  });
}
function plainText(html: string): string {
  const entities: Record<string, string> = { amp:'&', quot:'"', apos:"'", lt:'<', gt:'>', nbsp:' ' };
  return html.replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (whole, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || whole;
    const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
  }).trim().slice(0, 2048);
}
async function commonsRecording(word: Word): Promise<RecordingSource | undefined> {
  for (const form of recordingForms(word)) {
    const data = await json(wikiURL('en.wiktionary.org', { action: 'parse', page: form, prop: 'wikitext|images', redirects: '1' }));
    if (data.error?.code === 'missingtitle') continue;
    if (data.error) throw new Error('Recording lookup unavailable.');
    const parsed = data.parse;
    if (!parsed || parsed.title !== form || typeof parsed.wikitext !== 'string' || !Array.isArray(parsed.images)) continue;
    const files = mandarinFiles(parsed.wikitext, parsed.images, word).slice(0, 3);
    if (!files.length) continue;
    const media = await json(wikiURL('commons.wikimedia.org', { action: 'query', prop: 'videoinfo',
      titles: files.map(file => `File:${file}`).join('|'), viprop: 'url|extmetadata|derivatives' }));
    for (const page of media.query?.pages || []) {
      if (typeof page.title !== 'string' || !page.title.startsWith('File:') || !files.some(file => fileKey(page.title.slice(5)) === fileKey(file))) continue;
      const info = page.videoinfo?.[0], metadata = info?.extmetadata;
      const license = metadata?.LicenseShortName?.value;
      if (typeof license !== 'string' || !/^(CC0|Public domain|CC BY(?:-SA)? [\d.]+(?: [a-z]+)?)$/i.test(license)) continue;
      // A derivative supplied by Commons is preferable to an Ogg-only mobile path.
      const url = info.derivatives?.find((item: { type?: string }) => item.type === 'audio/mpeg')?.src || info.url;
      const licenseUrl = metadata?.LicenseUrl?.value;
      const author = typeof metadata?.Artist?.value === 'string' ? plainText(metadata.Artist.value) : '';
      if (typeof url !== 'string' || new URL(url).hostname !== 'upload.wikimedia.org' || !author || typeof licenseUrl !== 'string') continue;
      const source: RecordingSource = { provider: 'Wikimedia Commons', url, sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        author, license, licenseUrl: licenseUrl.replace(/^http:/, 'https:'), traditional: word.traditional, pinyin: word.pinyin, recordedForm: form };
      if (recordingMatches(source, word)) return source;
    }
  }
  return undefined;
}
export async function findRecording(word: Word, assetRoot: string): Promise<RecordingSource | undefined> {
  validateReading(word); characters(word.traditional);
  if (word.simplified) characters(word.simplified);
  let failure: unknown;
  try {
    const source = shtookaRecording(await loadRecordingIndex(assetRoot, 'shtooka-index.json.gz'), word);
    if (source) return source;
  } catch (error) { failure = error; }
  if (Date.now() < unavailableUntil) failure ||= new Error('Recording lookup temporarily unavailable.');
  else {
    try { const source = await commonsRecording(word); if (source) return source; }
    catch (error) { unavailableUntil = Math.max(unavailableUntil, Date.now() + 30000); failure = error; }
  }
  // MOE stays available even when the external Wikimedia metadata service is down.
  try { const source = await findMoeRecording(word, assetRoot); if (source) return source; }
  catch (error) { failure ||= error; }
  if (failure) throw failure;
  return undefined;
}
