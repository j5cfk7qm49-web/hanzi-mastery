import {describe,it,expect} from 'vitest';
import {particleHelp} from '../src/studyPacks/particleHelp';
import {nativeFront} from '../src/studyPacks/nativeRems';
import {compileClassicalChinese} from '../src/studyPacks/classicalChinese';
import {courseItem,syntheticHandoff} from './helpers/course-pack';

describe('Rem-backed particle vocabulary',()=>{
  const contextHints=[{text:'學',pinyin:'xué',meaning:'learn'},{text:'習',pinyin:'xí',meaning:'review'}];
  it('shows only authored surrounding words and refuses target-particle or malformed hints',()=>{
    expect(particleHelp({glyph:'學而習'})).toEqual([]);
    const item=courseItem({glyph:'學而習',mode:'particles',targetParticle:'而',contextHints,prompt:'Identify the function of 而.',answers:['conjunction'],reveal:'learn and review'});
    expect(particleHelp(item)).toEqual(contextHints);expect(nativeFront(item)).toContain('學 xué: learn; 習 xí: review');expect(nativeFront(item)).not.toMatch(/ér|conjunction|learn and review/);
    for(const patch of [{targetParticle:undefined},{targetParticle:'之'},{contextHints:[{text:'而',pinyin:'ér',meaning:'and'}]},{contextHints:[{text:'學而',pinyin:'xué ér',meaning:'learn and'}]},{contextHints:[{text:'木',pinyin:'mù',meaning:'wood'}]},{contextHints:[{text:'學',pinyin:'xué xí',meaning:'learn'}]},{contextHints:[{text:'學',pinyin:'xué',meaning:''}]}])expect(()=>particleHelp({...item,...patch})).toThrow();
  });
  it('imports optional context from source data without changing answers or full translations',()=>{
    const raw=syntheticHandoff() as Record<string,any>,word=raw['grammar.json'].empty_words[0],example=word.examples[0];example.text='學之習';example.context_hints=contextHints;
    const item=compileClassicalChinese(raw).items.find(i=>i.id==='particle-之-0')!;
    expect(item).toMatchObject({targetParticle:'之',contextHints,answers:['synthetic'],reveal:expect.stringContaining('Model translation: synthetic')});
    example.context_hints=[{text:'之',pinyin:'zhī',meaning:'of'}];expect(()=>compileClassicalChinese(raw)).toThrow('surrounding words only');
  });
});
