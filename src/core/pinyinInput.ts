import { convert } from 'pinyin-pro';
import { parsePinyin } from './recall';

export function toneSyllable(value: string, tone: number): string {
  try {
    const parts = parsePinyin(value);
    return parts.length === 1 ? convert(`${parts[0].base}${tone === 5 ? 0 : tone}`, { format: 'numToSymbol' }) : value;
  } catch { return value; }
}
/** Convert only what the learner enters; never complete a syllable from the expected answer. */
export function formatPinyinInput(value: string): string {
  return value.replace(/u:/gi, 'ü').replace(/v/gi, 'ü')
    .replace(/[a-züêāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ]+[0-5]/giu, token => toneSyllable(token.slice(0, -1), Number(token.at(-1)) || 5));
}
export function applyPinyinTone(value: string, caret: number, tone: number): { value: string; caret: number } {
  const before = value.slice(0, caret), after = value.slice(caret);
  const left = before.match(/[^\s'’\-]*$/u)?.[0] || '';
  const right = after.match(/^[^\s'’\-]*/u)?.[0] || '';
  const start = caret - left.length, end = caret + right.length;
  const marked = toneSyllable(left + right, tone);
  return { value: value.slice(0, start) + marked + value.slice(end), caret: start + marked.length };
}

/** Add the diacritic to the entered u; without one, insert ü at the cursor. */
export function applyPinyinUmlaut(value: string, from: number, to = from): { value: string; caret: number } {
  const left = value.slice(0, from).match(/[^\s'’\-]*$/u)?.[0] || '';
  const right = value.slice(from).match(/^[^\s'’\-]*/u)?.[0] || '';
  const before = [...left.matchAll(/[uūúǔùüǖǘǚǜ]/giu)].at(-1);
  const after = right.match(/[uūúǔùüǖǘǚǜ]/iu);
  const index = before ? from - left.length + before.index! : after ? from + after.index! : -1;
  if (index < 0) return { value: value.slice(0, from) + 'ü' + value.slice(to), caret: from + 1 };
  const vowel = value[index].normalize('NFD');
  const marked = vowel.includes('\u0308') ? value[index] : (vowel[0] + '\u0308' + vowel.slice(1)).normalize('NFC');
  return { value: value.slice(0, index) + marked + value.slice(index + 1), caret: Math.max(from, index + 1) };
}
