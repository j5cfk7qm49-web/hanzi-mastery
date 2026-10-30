import { gunzipSync, strFromU8 } from 'fflate';
import { convert } from 'pinyin-pro';
import { characters } from '../core/schema';
import { parsePinyin, pinyinKey } from '../core/pinyin';
import { radicalAudioBases } from '../core/radicals';
import { fetchWithTimeout } from './http';

export type RecordingWord = { traditional: string; simplified?: string; pinyin: string };
export type RecordingRow = [string, string, string];
const indexes = new Map<string, Promise<RecordingRow[]>>();
const readings = new WeakMap<RecordingRow[], Map<string, RecordingRow[]>>();

/** Compare explicit readings, including joined tone-marked source spelling. */
export function compactReading(reading: string): string {
  if (!/^[\p{Script=Latin}\p{Mark}0-5\s:'’\-]+$/u.test(reading)) return '';
  return convert(reading.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü').replace(/([0-5])(?=[a-zü])/g, '$1 '))
    .normalize('NFC').replace(/[\s'’\-]/g, '');
}
export const desiredReading = (word: RecordingWord) => compactReading(pinyinKey(parsePinyin(word.pinyin)));
export const recordingForms = (word: RecordingWord) => [...new Set([word.traditional, word.simplified,
  ...radicalAudioBases(word.traditional)].filter((value): value is string => !!value))];
export const isolatedCharacter = (word: RecordingWord) => characters(word.traditional).length === 1 && parsePinyin(word.pinyin).length === 1;

/** Prefer the actual form, then a radical alias, then an intact isolated syllable. */
export function matchRecordingRow(rows: RecordingRow[], word: RecordingWord, validId: RegExp): RecordingRow | undefined {
  const reading = desiredReading(word);
  let grouped = readings.get(rows);
  if (!grouped) {
    grouped = new Map();
    for (const row of rows) {
      const key = compactReading(row[1]);
      const group = grouped.get(key);
      if (group) group.push(row); else grouped.set(key, [row]);
    }
    readings.set(rows, grouped);
  }
  const matches = (grouped.get(reading) || []).filter(([, , id]) => validId.test(id));
  for (const form of recordingForms(word)) {
    const row = matches.find(([written]) => written === form);
    if (row) return row;
  }
  return isolatedCharacter(word) ? matches.find(([written]) => /^\p{Script=Han}$/u.test(written)) : undefined;
}

export async function loadRecordingIndex(assetRoot: string, filename: string): Promise<RecordingRow[]> {
  const url = new URL(`audio/${filename}`, assetRoot.endsWith('/') ? assetRoot : assetRoot + '/').href;
  let pending = indexes.get(url);
  if (!pending) {
    pending = fetchWithTimeout(url, async response => {
      if (!response.ok) throw new Error('Recording index unavailable.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 512 * 1024) throw new Error('Unexpected recording index size.');
      const index = JSON.parse(strFromU8(gunzipSync(bytes)));
      if (index.version !== 1 || !Array.isArray(index.records) || index.records.length > 10000 ||
        !index.records.every((row: unknown) => Array.isArray(row) && row.length === 3 && row.every(value => typeof value === 'string'))) {
        throw new Error('Invalid recording index.');
      }
      return index.records as RecordingRow[];
    });
    indexes.set(url, pending);
    void pending.catch(() => { if (indexes.get(url) === pending) indexes.delete(url); });
  }
  return pending;
}
