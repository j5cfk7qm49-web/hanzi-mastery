import { it, expect, vi } from 'vitest';
import { loadCharacter, validateCharacterData } from '../src/services/characters';
import { characters, parseWritingSchema, selectScript } from '../src/core/schema';
import { geometryFeedback } from '../src/core/geometry';
it('G: bundled Traditional targets load unchanged and have consistent stroke data', async () => {
  const expected=[16,11,10,14,22,23,13];
  for (const [i,ch] of Array.from('學國書語聽體愛').entries()) {
    const d=await loadCharacter(ch); expect(d.strokes.length).toBe(expected[i]); expect(d.medians.length).toBe(expected[i]);
  }
  expect(characters('學國')).toEqual(['學','國']);
});
it('requires explicit script forms and safe structured prompts', () => {
  const s={version:2,skill:'writing',vocabularyId:'v',traditional:'學',prompt:'study'};
  const schema=parseWritingSchema(JSON.stringify(s)); expect(selectScript(schema,'traditional')).toBe('學');
  expect(()=>selectScript(schema,'simplified')).toThrow('no explicit');
  expect(()=>parseWritingSchema(JSON.stringify({...s,prompt:'學'}))).toThrow();
  expect(()=>characters('學!')).toThrow();
});
it('rejects invalid data and unavailable characters without disclosing target text', async () => {
  expect(()=>validateCharacterData({strokes:['path'],medians:[]})).toThrow();
  const fetchMock=vi.spyOn(globalThis,'fetch').mockRejectedValueOnce(new Error('leaky target 𠮷'));
  await expect(loadCharacter('𠮷')).rejects.toThrow('Stroke data could not be loaded');
  fetchMock.mockRestore();
});
it('geometry diagnostic retains placement and length, independent of input point density', () => {
  const ref=[[0,0],[1024,0]];
  expect(geometryFeedback([{x:0,y:0},{x:1024,y:0}],ref)).toMatchObject({trajectoryError:0,lengthRatio:1});
  expect(geometryFeedback([{x:0,y:102},{x:1024,y:102}],ref)!.trajectoryError).toBeCloseTo(.099609);
  expect(geometryFeedback([{x:0,y:0},{x:512,y:0}],ref)!.lengthRatio).toBe(.5);
});
