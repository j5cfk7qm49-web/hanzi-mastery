import type { RecordingSource } from '../core/schema';
import { recordingMatches } from '../core/recordings';
import { isolatedCharacter, loadRecordingIndex, matchRecordingRow, type RecordingRow, type RecordingWord } from './recordingIndex';

export const MOE_AUDIO_SNAPSHOT = 'MOE Concise 2014_20260929';
export function moeRecording(rows: RecordingRow[], word: RecordingWord): RecordingSource | undefined {
  if (!isolatedCharacter(word)) return undefined;
  const row = matchRecordingRow(rows, word, /^\d{4}[A-Z]?$/);
  if (!row) return undefined;
  const source: RecordingSource = { provider: 'MOE Concise',
    url: `https://dict.concised.moe.edu.tw/sound/word/${row[2]}.mp3`,
    sourceUrl: `https://dict.concised.moe.edu.tw/search.jsp?md=1&word=${encodeURIComponent(row[0])}`,
    author: `Ministry of Education, R.O.C. (${MOE_AUDIO_SNAPSHOT})`, license: 'CC BY-ND 3.0 TW',
    licenseUrl: 'https://creativecommons.org/licenses/by-nd/3.0/tw/',
    traditional: word.traditional, pinyin: word.pinyin, recordedForm: row[0] };
  return recordingMatches(source, word) ? source : undefined;
}
export async function findMoeRecording(word: RecordingWord, assetRoot: string): Promise<RecordingSource | undefined> {
  if (!isolatedCharacter(word)) return undefined;
  return moeRecording(await loadRecordingIndex(assetRoot, 'moe-index.json.gz'), word);
}
