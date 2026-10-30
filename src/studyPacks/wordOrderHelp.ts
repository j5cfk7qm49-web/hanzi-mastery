import {parsePinyin} from '../core/pinyin';
import type {StudyItem} from './model';

/** Optional learning aids belong to the Rem, independently of the tested relation. */
export function wordOrderHelp(item:Pick<StudyItem,'glyph'|'syllables'|'glosses'>) {
  if(item.syllables===undefined && item.glosses===undefined)return [];
  const characters=[...(item.glyph||'')];
  if(!characters.length || !Array.isArray(item.syllables) || !Array.isArray(item.glosses) || item.syllables.length!==characters.length || item.glosses.length!==characters.length ||
    item.syllables.some(p=>typeof p!=='string' || parsePinyin(p).length!==1) || item.glosses.some(g=>typeof g!=='string' || !g.trim() || g.length>250))throw Error('Word-order help needs one Pinyin syllable and meaning for each character.');
  return characters.map((character,i)=>({character,pinyin:item.syllables![i],meaning:item.glosses![i]}));
}
