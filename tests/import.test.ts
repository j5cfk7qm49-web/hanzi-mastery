import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { convertPleco, convertCSV, parseDelimited, vocabularyMarkdown } from '../src/importers/converters';
it('converts documented Pleco Both format, merging duplicate category membership and preserving provenance',async()=>{
  const text=await readFile('tests/fixtures/pleco-synthetic.txt','utf8');
  const entries=convertPleco(text,'sample.txt','traditional');
  expect(entries).toHaveLength(2);expect(entries[0]).toMatchObject({traditional:'學習',simplified:'学习',pinyin:'xue2 xi2',categories:['Textbook/Chapter 1','Favorites']});
  expect(entries[0].provenance).toHaveLength(2);
});
it('does not infer the script of bare headwords or invent XML history compatibility',()=>{
  expect(()=>convertPleco('学\txue2\tstudy')).toThrow('no verified script');
  expect(()=>convertPleco('<plecoflash/>')).toThrow('XML is not supported');
});
it('supports quoted and multiline CSV, explicit mapping, audio references and unverified TOCFL labels',async()=>{
  const entries=convertCSV(await readFile('tests/fixtures/vocabulary-synthetic.csv','utf8'));
  expect(entries[0].tocfl).toMatchObject({level:'A1',verified:false});expect(entries[1].audio).toEqual(['https://example.com/audio.mp3']);
  expect(parseDelimited('a,b\r\n"one\ntwo","quote ""three"""\r\n')).toEqual([['a','b'],['one\ntwo','quote "three"']]);
  expect(convertCSV('Characters,English\n學,study','mapped.csv',{traditional:'Characters',meanings:'English'})[0].traditional).toBe('學');
});
it('rejects malformed rows and preserves unknown columns only as provenance, not scheduling data',()=>{
  expect(()=>convertCSV('traditional,meanings\n學,study,extra')).toThrow('column count');
  expect(()=>parseDelimited('a,b\n"unclosed,b')).toThrow('Unclosed');
  const entries=convertCSV('traditional,pinyin,history\n學,xue2,999');
  expect(entries[0].provenance[0].raw.history).toBe('999');expect(entries[0]).not.toHaveProperty('history');
  expect(vocabularyMarkdown(entries)).not.toContain('::');
});
