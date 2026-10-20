import { characters } from './schema';

export const RECALL_POWERUP = 'hanzi-recall-v1';
export const RECALL_SKILLS = ['pinyin', 'tones', 'listening', 'pronunciation'] as const;
export type RecallSkill = typeof RECALL_SKILLS[number];
export const RECALL_NAMES: Record<RecallSkill, string> = {
  pinyin: 'Pinyin recall', tones: 'Tone recall', listening: 'Listening', pronunciation: 'Spoken practice',
};
export interface Syllable { base: string; tone: number }
const marks: Record<string, number> = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 };

/** Explicit syllable boundaries avoid guessing readings of ambiguous words. Unmarked = neutral. */
export function parsePinyin(text: string): Syllable[] {
  const tokens = text.trim().toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü')
    .replace(/([0-5])(?=[a-zü])/g, '$1 ').split(/[\s'’\-]+/u).filter(Boolean);
  if (!tokens.length || tokens.length > 12) throw new Error('Enter pinyin with one syllable per character, separated by spaces.');
  return tokens.map(token => {
    let base = '', marked = 0;
    const digit = token.match(/[0-5]$/)?.[0];
    const letters = digit ? token.slice(0, -1) : token;
    for (const ch of letters.normalize('NFD')) {
      if (marks[ch]) {
        if (marked) throw new Error('Each pinyin syllable needs at most one tone mark.');
        marked = marks[ch];
      } else base += ch;
    }
    base = base.normalize('NFC');
    if (!/^[a-züê]+$/u.test(base) || base.length > 8 || (marked && digit && marked !== Number(digit))) {
      throw new Error('Use pinyin letters and tone marks or numbers 1–5; use ü, v or u: for ü.');
    }
    return { base, tone: marked || (digit ? Number(digit) || 5 : 5) };
  });
}
export const pinyinKey = (syllables: Syllable[]) => syllables.map(s => `${s.base}${s.tone}`).join(' ');
export interface RecallSchema {
  version: 1; skill: RecallSkill; vocabularyId: string;
  traditional: string; pinyin: string; meaning: string; referenceAudio?: string;
}
export function validateAudioUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Reference audio must be an HTTPS URL without embedded credentials.');
  return url.href;
}
export function parseRecallSchema(raw: string): RecallSchema {
  let value: RecallSchema;
  try { value = JSON.parse(raw); } catch { throw new Error('Study-card metadata is missing. Create this card in the Hanzi Mastery workbench.'); }
  if (!value || value.version !== 1 || !RECALL_SKILLS.includes(value.skill) ||
      typeof value.vocabularyId !== 'string' || !value.vocabularyId || typeof value.traditional !== 'string' ||
      typeof value.pinyin !== 'string' || typeof value.meaning !== 'string') throw new Error('Invalid study-card metadata.');
  if (characters(value.traditional).length !== parsePinyin(value.pinyin).length) {
    throw new Error('Provide exactly one pinyin syllable per character, separated by spaces. Create separate vocabulary entries for different readings.');
  }
  if (value.referenceAudio !== undefined) {
    if (typeof value.referenceAudio !== 'string') throw new Error('Invalid reference audio.');
    validateAudioUrl(value.referenceAudio);
  }
  return value;
}
export function recallFront(schema: RecallSchema): string {
  return schema.skill === 'listening' ? 'Listen and recall the dictionary pinyin.' : `${RECALL_NAMES[schema.skill]}: ${schema.traditional}`;
}
export function recallTargetKey(schema: RecallSchema): string {
  return JSON.stringify([schema.traditional, pinyinKey(parsePinyin(schema.pinyin)), schema.referenceAudio || 'device-voice']);
}
export interface RecallResult {
  passed: boolean; accuracy: number; spellingCorrect: number; tonesCorrect: number; total: number;
  assessment: 'checked' | 'self'; failure?: 'answer-revealed' | 'forgotten'; answer?: string;
}
export function checkRecall(schema: RecallSchema, answer: string | number[]): RecallResult {
  const expected = parsePinyin(schema.pinyin);
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
