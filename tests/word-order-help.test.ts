import {describe,it,expect} from 'vitest';
import {wordOrderHelp} from '../src/studyPacks/wordOrderHelp';
import {compileClassicalChinese} from '../src/studyPacks/classicalChinese';
import {syntheticHandoff} from './helpers/course-pack';
describe('Rem-backed word-order aids',()=>{
  it('accepts optional aligned character help and refuses incomplete or invalid hints',()=>{
    expect(wordOrderHelp({glyph:'父母'})).toEqual([]);
    expect(wordOrderHelp({glyph:'父母',syllables:['fù','mǔ'],glosses:['father','mother']})).toEqual([{character:'父',pinyin:'fù',meaning:'father'},{character:'母',pinyin:'mǔ',meaning:'mother'}]);
    for(const invalid of [{glyph:'父母',syllables:['fù'],glosses:['father','mother']},{glyph:'父母',syllables:['fù','mǔ']},{glyph:'父母',syllables:['fù','mǔ'],glosses:['father','']},{glyph:'父母',syllables:['fù mǔ','mǔ'],glosses:['father','mother']}])expect(()=>wordOrderHelp(invalid)).toThrow();
  });
  it('imports supplied hints without changing the classification or revealing translation hints in other modes',()=>{
    const raw=syntheticHandoff() as Record<string,any>,row=raw['grammar.json'].word_order_items[0];row.pinyin_syllables=['xiū','xíng'];row.character_meanings=['cultivate','conduct'];
    const pack=compileClassicalChinese(raw),item=pack.items.find(i=>i.id===row.id)!;expect(item).toMatchObject({mode:'word-order',syllables:['xiū','xíng'],glosses:['cultivate','conduct'],answers:['coordinate','modifier_modified']});
    expect(pack.items.find(i=>i.id==='translate-'+row.id)?.glosses).toBeUndefined();row.character_meanings=['cultivate'];expect(()=>compileClassicalChinese(raw)).toThrow('one Pinyin syllable');
  });
});
