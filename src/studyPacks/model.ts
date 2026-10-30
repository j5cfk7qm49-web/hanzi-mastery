/** Optional study activities have no dependency on the native review queue. */
export type ItemKind = 'oral' | 'text' | 'choice' | 'circle' | 'writing';
export interface StudyItem {
  id: string; remId?:string; section: number; mode: string; kind: ItemKind; prompt: string;
  glyph?: string; answers: string[]; reveal: string; source: string;
  choices?: string[]; audioId?: string; syllables?: string[]; glosses?:string[]; selfGrade?: boolean; input?:'pinyin'|'text';
  /** Visible reference for a writing question, distinct from the hidden target. */
  referenceGlyph?: string; showPinyin?: boolean;
  /** Display-only vocabulary support; never explain the particle being tested. */
  targetParticle?: string; contextHints?: {text:string;pinyin:string;meaning:string}[];
}
export interface PackAudio { id: string; path: string; sha256: string; bytes: number; remId?:string; url?:string }
export interface StudyPack {
  schemaVersion: 1; studyPackId: string; sourceVersion: string; title: string;
  /** Explicit list-level opt-in; never enable a card when this is absent/false. */
  scheduledCardsPaused?: boolean;
  sections: { id: number; title: string }[]; items: StudyItem[]; audio: PackAudio[]; audioVersion?:string; notes: string[];
}
export interface StudyEvent { id: string; at: number; passed: boolean; assessment: 'checked' | 'self' }
export interface ItemProgress { attempts: number; misses: number; lastPassed?: boolean; events: StudyEvent[] }
export interface StudySession { id: string; section?: number; sourceVersion: string; ids: string[]; index: number; label: string; draft?: { itemId: string; answer: string; submitted: boolean; points?: number[][][] } }
export const PACK_NAMESPACE = 'hanzi-mastery-study-pack-v1:';
export const emptyProgress = (): ItemProgress => ({ attempts: 0, misses: 0, events: [] });
export function shuffled<T>(values: T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function normalizeAnswer(value: string, ignoreTone = false): string {
  let result = value.normalize('NFC').toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü').replace(/[’‘]/g, "'");
  if (ignoreTone) result = result.normalize('NFD').replace(/[\u0300\u0301\u0304\u030c]/g, '').normalize('NFC');
  return result.replace(/[\s,，、;；.。]/g, '');
}
export function assessAnswer(item: StudyItem, answer: string): 'correct' | 'review' | 'incorrect' {
  if (item.selfGrade && item.kind!=='choice') return 'review';
  if (item.answers.some(a => normalizeAnswer(a,item.mode==='spelling') === normalizeAnswer(answer,item.mode==='spelling'))) return 'correct';
  // Names and factual substance receive a comparison prompt for plausible spelling variants.
  if (item.mode === 'facts' || item.mode === 'radical-identity') return 'review';
  return 'incorrect';
}
