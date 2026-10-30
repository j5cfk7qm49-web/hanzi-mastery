import {parsePinyin} from '../core/pinyin';
import type {StudyItem} from './model';

/** Authored in the exercise Rem; full translations and particle functions stay on the back. */
export function particleHelp(item:Pick<StudyItem,'glyph'|'targetParticle'|'contextHints'>) {
  if(item.contextHints===undefined)return [];
  const target=item.targetParticle;
  if(typeof target!=='string' || !/^\p{Script=Han}$/u.test(target) || !item.glyph?.includes(target) || !Array.isArray(item.contextHints) || item.contextHints.length>50)
    throw Error('Particle vocabulary needs a target particle present in the example.');
  for(const hint of item.contextHints){
    if(!hint || typeof hint.text!=='string' || !/^\p{Script=Han}{1,24}$/u.test(hint.text) || !item.glyph.includes(hint.text) || hint.text.includes(target) ||
      typeof hint.pinyin!=='string' || parsePinyin(hint.pinyin).length!==[...hint.text].length || typeof hint.meaning!=='string' || !hint.meaning.trim() || hint.meaning.length>250)
      throw Error('Particle vocabulary must describe surrounding words only, with aligned Pinyin and meanings.');
  }
  return item.contextHints;
}
