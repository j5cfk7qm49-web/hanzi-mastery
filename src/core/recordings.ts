import type { RecordingSource } from './schema';
import { characters } from './schema';
import { parsePinyin, pinyinKey, validateAudioUrl } from './pinyin';

export function validateRecordingSource(value: RecordingSource): void {
  if (!value || !['Shtooka', 'Wikimedia Commons', 'MOE Concise'].includes(value.provider) ||
    !(['url', 'sourceUrl', 'author', 'license', 'licenseUrl', 'traditional', 'pinyin'] as const).every(key =>
      typeof value[key] === 'string' && value[key].length > 0 && value[key].length < 4096)) {
    throw new Error('Invalid recording source.');
  }
  for (const url of [value.url, value.sourceUrl, value.licenseUrl]) validateAudioUrl(url);
  if (value.recordedForm !== undefined) characters(value.recordedForm);
  const host = value.provider === 'Shtooka' ? 'fsi-languages.yojik.eu' : value.provider === 'MOE Concise' ? 'dict.concised.moe.edu.tw' : 'upload.wikimedia.org';
  const sourceHost = value.provider === 'Wikimedia Commons' ? 'commons.wikimedia.org' : host;
  if (new URL(value.url).hostname !== host || new URL(value.sourceUrl).hostname !== sourceHost ||
    new URL(value.licenseUrl).hostname !== 'creativecommons.org') throw new Error('Invalid recording source host.');
}

export function recordingMatches(source: RecordingSource | undefined, word: { traditional: string; pinyin: string }): source is RecordingSource {
  if (!source) return false;
  try {
    validateRecordingSource(source);
    return source.traditional === word.traditional && pinyinKey(parsePinyin(source.pinyin)) === pinyinKey(parsePinyin(word.pinyin));
  } catch { return false; }
}
