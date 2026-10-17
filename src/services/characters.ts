import type { CharacterJson } from 'hanzi-writer';
import xue from 'hanzi-writer-data/學.json';
import guo from 'hanzi-writer-data/國.json';
import shu from 'hanzi-writer-data/書.json';
import yu from 'hanzi-writer-data/語.json';
import ting from 'hanzi-writer-data/聽.json';
import ti from 'hanzi-writer-data/體.json';
import ai from 'hanzi-writer-data/愛.json';
import { CHARACTER_OVERRIDES } from '../data/overrides';
const core: Record<string, CharacterJson> = { 學: xue, 國: guo, 書: shu, 語: yu, 聽: ting, 體: ti, 愛: ai };
const cache = new Map<string, CharacterJson>();
export function validateCharacterData(raw: unknown): CharacterJson {
  const d = raw as CharacterJson;
  if (!d || !Array.isArray(d.strokes) || !Array.isArray(d.medians) || d.strokes.length < 1 || d.strokes.length > 100 ||
      d.strokes.length !== d.medians.length || !d.strokes.every(s => typeof s === 'string' && s.length > 0) ||
      !d.medians.every(m => Array.isArray(m) && m.length > 1 && m.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))) {
    throw new Error('Character data is invalid. Testing is blocked.');
  }
  return d;
}
export async function loadCharacter(character: string, assetRoot = window.location.href): Promise<CharacterJson> {
  if (!/^\p{Script=Han}$/u.test(character)) throw new Error('Invalid character selection.');
  if (CHARACTER_OVERRIDES[character]) return validateCharacterData(CHARACTER_OVERRIDES[character].data);
  if (core[character]) return validateCharacterData(core[character]);
  if (cache.has(character)) return cache.get(character)!;
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 12000);
  try {
    const url = new URL(`data/${character.codePointAt(0)!.toString(16)}.json`, assetRoot);
    const response = await fetch(url, { signal: abort.signal, cache: 'force-cache' });
    if (!response.ok) throw new Error('Unavailable');
    const d = validateCharacterData(await response.json());
    cache.set(character, d);
    return d;
  } catch {
    // Do not include target, URL, or raw HTTP error on the question side.
    throw new Error('Stroke data could not be loaded. Check the plugin assets or connection, then retry. This attempt is not graded.');
  } finally { clearTimeout(timeout); }
}
