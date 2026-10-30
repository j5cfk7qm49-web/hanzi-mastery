import { characters, type Vocabulary } from './schema';
import { parsePinyin, validateAudioUrl } from './recall';
import { recordingMatches } from './recordings';
export function validateVocabulary(v: Vocabulary): void {
  if (!v || v.version !== 2 || typeof v.traditional !== 'string' || typeof v.pinyin !== 'string' ||
      !Array.isArray(v.meanings) || !v.meanings.length || !v.meanings.every(m => typeof m === 'string' && m.trim() && !/\p{Script=Han}/u.test(m)) ||
      typeof v.source !== 'string' || !Array.isArray(v.categories) || !v.categories.every(c => typeof c === 'string')) throw new Error('Supply characters and at least one English study meaning.');
  characters(v.traditional); if (v.simplified !== undefined) characters(v.simplified);
  if (v.pinyin.trim() && parsePinyin(v.pinyin).length !== Array.from(v.traditional).length) throw new Error('Provide one pinyin syllable per character.');
  if (v.audio !== undefined) {
    if (!Array.isArray(v.audio)) throw new Error('Invalid reference audio.');
    v.audio.forEach(validateAudioUrl);
  }
  if (v.audioSource !== undefined && (!recordingMatches(v.audioSource, v) || v.audio?.[0] !== v.audioSource.url)) throw new Error('The recording does not match this word reading.');
}
