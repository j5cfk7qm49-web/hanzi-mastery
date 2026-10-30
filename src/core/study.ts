import { RECALL_NAMES, RECALL_SKILLS, type RecallSkill } from './recall';
export type StudySkill = 'writing' | RecallSkill;
export const STUDY_SKILLS: readonly StudySkill[] = ['writing', ...RECALL_SKILLS];
export const STUDY_NAMES: Record<StudySkill, string> = { writing: 'Writing', ...RECALL_NAMES };
export const defaultWritingPrompt = (word: { meanings: string[]; pinyin: string }) =>
  word.meanings.join('; ') + (word.pinyin.trim() ? ` (${word.pinyin.trim()})` : '');
