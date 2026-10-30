import { characters, type RecordingSource } from './schema';
import { recordingMatches } from './recordings';
import { parsePinyin, pinyinKey, spellingKey, validateReading, validateAudioUrl, type CharacterChoice, type Syllable } from './pinyin';
export { parsePinyin, pinyinKey, spellingKey, validateReading, validateAudioUrl, type Syllable, type CharacterChoice } from './pinyin';

export const RECALL_POWERUP = 'hanzi-recall-v1';
export const RECALL_SKILLS = ['english-to-chinese', 'chinese-to-english', 'pinyin', 'tones', 'character-choice', 'listening', 'pronunciation'] as const;
export type RecallSkill = typeof RECALL_SKILLS[number];
export const RECALL_NAMES: Record<RecallSkill, string> = {
  'english-to-chinese': 'Meaning to characters', 'chinese-to-english': 'Characters to meaning',
  pinyin: 'Pinyin recall', tones: 'Tone recall', 'character-choice': 'Character recognition', listening: 'Listening', pronunciation: 'Spoken practice',
};
export const isTranslationSkill = (skill: RecallSkill) => skill === 'english-to-chinese' || skill === 'chinese-to-english';
const soundLabels=(value:string)=>/^[a-züê]{1,4}(?: [a-züê]{1,4}){0,3}$/u.test(value);
export function shuffleChoices<T>(values: readonly T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export interface RecallSchema {
  version: 1; skill: RecallSkill; vocabularyId: string;
  traditional: string; pinyin: string; meaning: string; referenceAudio?: string;
  choices?: CharacterChoice[];
  /** A new translation Rem schedules its native forward and backward cards independently. */
  bidirectional?: boolean;
  /** Keep the original result/mastery namespace through corrections. */
  historyTarget?: string;
  customPrompt?: string;
  reversePrompt?: string;
  customAudio?: boolean;
  audioSource?: RecordingSource;
  nativeStudy?: import('../services/nativeStudyReviews').NativeStudyBinding;
  /** Explicit alternative readings on one existing card, e.g. an unpositioned 阝. */
  pinyinAlternatives?: string[];
  /** A Pinyin sound label rather than a Han word (spoken practice or listening). */
  phoneticOnly?: boolean;
  /** Authored recording exercises must not silently substitute a device voice. */
  referenceRequired?: boolean;
}
export function parseRecallSchema(raw: string): RecallSchema {
  let value: RecallSchema;
  try { value = JSON.parse(raw); } catch { throw new Error('Study-card metadata is missing. Create this card in the Hanzi Mastery workbench.'); }
  if (!value || value.version !== 1 || !RECALL_SKILLS.includes(value.skill) ||
      typeof value.vocabularyId !== 'string' || !value.vocabularyId || typeof value.traditional !== 'string' ||
      typeof value.pinyin !== 'string' || typeof value.meaning !== 'string') throw new Error('Invalid study-card metadata.');
  if (value.bidirectional !== undefined && (typeof value.bidirectional !== 'boolean' || !isTranslationSkill(value.skill))) throw new Error('Invalid translation direction.');
  for (const key of ['historyTarget', 'customPrompt', 'reversePrompt'] as const) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || !value[key]!.trim())) throw new Error('Invalid study-card customization.');
  }
  if (value.customAudio !== undefined && typeof value.customAudio !== 'boolean') throw new Error('Invalid audio customization.');
  if (value.phoneticOnly !== undefined && typeof value.phoneticOnly !== 'boolean') throw new Error('Invalid sound-label practice.');
  if (value.referenceRequired !== undefined && typeof value.referenceRequired !== 'boolean') throw new Error('Invalid recording requirement.');
  if (isTranslationSkill(value.skill)) {
    characters(value.traditional);
    if (!value.meaning.trim() || /\p{Script=Han}/u.test(value.meaning)) throw new Error('Translation cards need an English study meaning without Chinese answer characters.');
    if (value.pinyin.trim()) validateReading(value);
  } else if(value.phoneticOnly){
    if(!['pronunciation','listening'].includes(value.skill) || !soundLabels(value.traditional) || value.pinyin!==value.traditional)throw Error('Invalid sound-label practice.');
  } else validateReading(value);
  if(value.pinyinAlternatives!==undefined){
    if(!(value.skill==='pinyin' || (value.skill==='listening' && value.phoneticOnly)) || !Array.isArray(value.pinyinAlternatives) || value.pinyinAlternatives.length>8)throw Error('Invalid alternative readings.');
    for(const pinyin of value.pinyinAlternatives){
      if(value.phoneticOnly){if(typeof pinyin!=='string' || !soundLabels(pinyin))throw Error('Invalid alternative sound label.');}
      else validateReading({traditional:value.traditional,pinyin});
    }
  }
  if (value.skill === 'character-choice') {
    if (!Array.isArray(value.choices) || value.choices.length < 2 || value.choices.length > 4) {
      throw new Error('Character recognition needs two to four verified choices. Recreate this card in the workbench.');
    }
    const forms = new Set<string>(), readings = new Set<string>();
    for (const choice of value.choices) {
      validateReading(choice);
      const key = spellingKey(choice.pinyin);
      if (Array.from(choice.traditional).length !== Array.from(value.traditional).length || forms.has(choice.traditional) || readings.has(key)) {
        throw new Error('Character choices must have distinct characters and pinyin, without homophones or tone-only differences.');
      }
      forms.add(choice.traditional); readings.add(key);
    }
    const correct = value.choices.filter(c => c.traditional === value.traditional &&
      pinyinKey(parsePinyin(c.pinyin)) === pinyinKey(parsePinyin(value.pinyin)));
    if (correct.length !== 1) throw new Error('Character recognition needs exactly one matching answer.');
  }
  if (value.referenceAudio !== undefined) {
    if (typeof value.referenceAudio !== 'string') throw new Error('Invalid reference audio.');
    validateAudioUrl(value.referenceAudio);
  }
  if (value.audioSource !== undefined && (!recordingMatches(value.audioSource, value) || value.audioSource.url !== value.referenceAudio)) throw new Error('The recording does not match this card reading.');
  return value;
}
export function recallFront(schema: RecallSchema): string {
  if (schema.bidirectional) return schema.meaning;
  if (schema.customPrompt) return schema.customPrompt;
  if (schema.skill === 'english-to-chinese') return `Recall the characters for: ${schema.meaning}`;
  if (schema.skill === 'chinese-to-english') return `Recall the meaning of: ${schema.traditional}`;
  if (schema.skill === 'character-choice') return `Choose the characters for: ${schema.pinyin}`;
  return schema.skill === 'listening' ? 'Listen and recall the dictionary pinyin.' : `${RECALL_NAMES[schema.skill]}: ${schema.traditional}`;
}
export function recallTargetKey(schema: RecallSchema): string {
  if (schema.historyTarget) return schema.historyTarget;
  const reading = schema.pinyin.trim() ? pinyinKey(parsePinyin(schema.pinyin)) : '';
  return JSON.stringify([schema.traditional, reading, schema.referenceAudio || 'device-voice',
    ...(isTranslationSkill(schema.skill) ? [schema.meaning] : [])]);
}
export interface RecallResult {
  passed: boolean; accuracy: number; spellingCorrect: number; tonesCorrect: number; total: number;
  assessment: 'checked' | 'self'; failure?: 'answer-revealed' | 'forgotten'; answer?: string;
}
export function checkRecall(schema: RecallSchema, answer: string | number[]): RecallResult {
  if(schema.pinyinAlternatives?.length){
    return [schema.pinyin,...schema.pinyinAlternatives].map(pinyin=>checkRecall({...schema,pinyin,pinyinAlternatives:undefined},answer))
      .reduce((best,result)=>result.passed || result.accuracy>best.accuracy ? result : best);
  }
  if(schema.skill==='listening' && schema.phoneticOnly){
    const expected=parsePinyin(schema.pinyin);let actual:Syllable[]=[];
    try{if(typeof answer==='string')actual=parsePinyin(answer);}catch{/* A malformed first answer is incorrect. */}
    const spellingCorrect=expected.filter((s,i)=>s.base===actual[i]?.base).length;
    const sameLength=actual.length===expected.length,passed=sameLength && spellingCorrect===expected.length;
    return {passed,accuracy:sameLength?spellingCorrect/expected.length:0,spellingCorrect,tonesCorrect:0,total:expected.length,assessment:'checked',answer:typeof answer==='string'?answer.slice(0,200):''};
  }
  const expected = parsePinyin(schema.pinyin);
  if (schema.skill === 'character-choice') {
    const passed = typeof answer === 'string' && answer === schema.traditional &&
      !!schema.choices?.some(c => c.traditional === answer);
    return { passed, accuracy: Number(passed), spellingCorrect: 0, tonesCorrect: 0, total: expected.length,
      assessment: 'checked', answer: typeof answer === 'string' ? answer.slice(0, 200) : '' };
  }
  let actual: Syllable[] = [];
  if (typeof answer === 'string') { try { actual = parsePinyin(answer); } catch { /* Invalid submitted text is an incorrect first answer. */ } }
  const spellingCorrect = Array.isArray(answer) ? expected.length : expected.filter((s, i) => s.base === actual[i]?.base).length;
  const tonesCorrect = expected.filter((s, i) => s.tone === (Array.isArray(answer) ? answer[i] : actual[i]?.tone)).length;
  const lengthMatches = (Array.isArray(answer) ? answer.length : actual.length) === expected.length;
  const correct = expected.filter((s, i) => Array.isArray(answer) ? s.tone === answer[i] :
    s.base === actual[i]?.base && s.tone === actual[i]?.tone).length;
  return { passed: lengthMatches && correct === expected.length, accuracy: lengthMatches ? correct / expected.length : 0,
    spellingCorrect, tonesCorrect, total: expected.length, assessment: 'checked',
    answer: Array.isArray(answer) ? answer.join(' ') : answer.slice(0, 200) };
}
