export const WRITING_POWERUP = 'hanzi-writing-v2';
export const VOCAB_POWERUP = 'hanzi-vocabulary-v2';
export const SCHEMA_SLOT = 'schema';
export const SETTINGS_KEY = 'hm:v2:settings';
export interface WritingSchema {
  version: 2; skill: 'writing'; vocabularyId: string;
  traditional: string; simplified?: string; prompt: string;
}
export const SKILLS = ['recognition', 'writing', 'english-to-chinese', 'chinese-to-english', 'pinyin', 'tones', 'listening', 'pronunciation'] as const;
export interface Vocabulary {
  version: 2; traditional: string; simplified?: string; pinyin: string; meanings: string[];
  partOfSpeech?: string; examples?: { chinese: string; english?: string }[]; audio?: string[];
  tocfl?: { level: string; source: string; verified: boolean }; source: string; categories: string[];
  tags?: string[]; dictionaryLinks?: string[];
}
export function characters(text: string): string[] {
  const result = Array.from(text);
  if (!result.length || result.length > 12 || !result.every(c => /^\p{Script=Han}$/u.test(c))) throw new Error('Enter 1–12 Han characters without spaces or punctuation.');
  return result;
}
export function parseWritingSchema(raw: string): WritingSchema {
  let s: WritingSchema;
  try { s = JSON.parse(raw); } catch { throw new Error('Writing metadata is missing or invalid. Use the Hanzi Mastery workbench to create this card.'); }
  if (s.version !== 2 || s.skill !== 'writing' || typeof s.vocabularyId !== 'string' || !s.vocabularyId ||
      typeof s.traditional !== 'string' || typeof s.prompt !== 'string' || !s.prompt.trim() || /\p{Script=Han}/u.test(s.prompt)) {
    throw new Error('Writing metadata is invalid, or the prompt contains an answer character.');
  }
  characters(s.traditional);
  if (s.simplified !== undefined) characters(s.simplified);
  return s;
}
export function selectScript(s: WritingSchema, script: 'traditional' | 'simplified'): string {
  if (script === 'simplified') {
    if (!s.simplified) throw new Error('This card has no explicit Simplified form. Add it in the workbench or switch to Traditional.');
    return s.simplified;
  }
  return s.traditional;
}
