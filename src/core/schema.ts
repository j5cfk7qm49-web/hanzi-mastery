export const WRITING_POWERUP = 'hanzi-writing-v2';
export const VOCAB_POWERUP = 'hanzi-vocabulary-v2';
export const SCHEMA_SLOT = 'schema';
export const SETTINGS_KEY = 'hm:v2:settings';
export interface WritingSchema {
  version: 2; skill: 'writing'; vocabularyId: string;
  traditional: string; simplified?: string; prompt: string;
  customPrompt?: boolean;
  referenceGlyph?: string;
  nativeStudy?: import('../services/nativeStudyReviews').NativeStudyBinding;
}
export const SKILLS = ['recognition', 'writing', 'english-to-chinese', 'chinese-to-english', 'pinyin', 'tones', 'character-choice', 'listening', 'pronunciation'] as const;
export interface Vocabulary {
  version: 2; traditional: string; simplified?: string; pinyin: string; meanings: string[];
  partOfSpeech?: string; examples?: { chinese: string; english?: string }[]; audio?: string[];
  tocfl?: { level: string; source: string; verified: boolean }; source: string; categories: string[];
  tags?: string[]; dictionaryLinks?: string[];
  dictionary?: DictionaryProvenance;
  audioSource?: RecordingSource;
}
/** A recording is bound to the saved form and reading, separately from custom audio. */
export interface RecordingSource {
  provider: 'Shtooka' | 'Wikimedia Commons' | 'MOE Concise'; url: string; sourceUrl: string;
  author: string; license: string; licenseUrl: string;
  traditional: string; pinyin: string;
  /** The original recorded glyph/word, including a base-radical audio alias. */
  recordedForm?: string;
}
export interface DictionaryProvenance {
  importedAt: string;
  moe?: { provider: 'MOE Revised via Moedict'; url: string; pinyin: string; bopomofo: string; definitions: string[]; license: 'CC BY-ND 3.0 TW'; edition: string };
  english?: { provider: 'CC-CEDICT'; url: string; snapshot: string; pinyin: string; definitions: string[]; license: 'CC BY-SA 4.0' };
}
export function characters(text: string): string[] {
  if (typeof text !== 'string') throw new Error('Enter 1–12 Han characters without spaces or punctuation.');
  const result = Array.from(text);
  if (!result.length || result.length > 12 || !result.every(c => /^\p{Script=Han}$/u.test(c))) throw new Error('Enter 1–12 Han characters without spaces or punctuation.');
  return result;
}
export function parseWritingSchema(raw: string): WritingSchema {
  let s: WritingSchema;
  try { s = JSON.parse(raw); } catch { throw new Error('Writing metadata is missing or invalid. Use the Hanzi Mastery workbench to create this card.'); }
  if (!s || s.version !== 2 || s.skill !== 'writing' || typeof s.vocabularyId !== 'string' || !s.vocabularyId ||
      typeof s.traditional !== 'string' || typeof s.prompt !== 'string' || !s.prompt.trim() || /\p{Script=Han}/u.test(s.prompt)) {
    throw new Error('Writing metadata is invalid, or the prompt contains an answer character.');
  }
  characters(s.traditional);
  if(s.referenceGlyph!==undefined)characters(s.referenceGlyph);
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
