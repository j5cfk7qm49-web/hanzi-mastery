import { characters } from './schema';

export interface Syllable { base: string; tone: number }
const marks: Record<string, number> = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 };

/** Explicit syllable boundaries avoid guessing readings of ambiguous words. Unmarked = neutral. */
export function parsePinyin(text: string): Syllable[] {
  const tokens = text.trim().toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü')
    .replace(/([0-5])(?=[a-zü])/g, '$1 ').split(/[\s'’\-]+/u).filter(Boolean);
  if (!tokens.length || tokens.length > 12) throw new Error('Enter pinyin with one syllable per character, separated by spaces.');
  return tokens.map(token => {
    let base = '', marked = 0;
    const digit = token.match(/[0-5]$/)?.[0];
    const letters = digit ? token.slice(0, -1) : token;
    for (const ch of letters.normalize('NFD')) {
      if (marks[ch]) {
        if (marked) throw new Error('Each pinyin syllable needs at most one tone mark.');
        marked = marks[ch];
      } else base += ch;
    }
    base = base.normalize('NFC');
    if (!/^[a-züê]+$/u.test(base) || base.length > 8 || (marked && digit && marked !== Number(digit))) {
      throw new Error('Use pinyin letters and tone marks or numbers 1–5; use ü, v or u: for ü.');
    }
    return { base, tone: marked || (digit ? Number(digit) || 5 : 5) };
  });
}
export const pinyinKey = (syllables: Syllable[]) => syllables.map(s => `${s.base}${s.tone}`).join(' ');
export const spellingKey = (pinyin: string) => parsePinyin(pinyin).map(s => s.base).join(' ');
export interface CharacterChoice { traditional: string; pinyin: string }
export function validateReading(value: CharacterChoice): void {
  if (!value || typeof value.traditional !== 'string' || typeof value.pinyin !== 'string' ||
      characters(value.traditional).length !== parsePinyin(value.pinyin).length) {
    throw new Error('Provide exactly one pinyin syllable per character, separated by spaces. Create separate vocabulary entries for different readings.');
  }
}
export function validateAudioUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Reference audio must be an HTTPS URL without embedded credentials.');
  return url.href;
}
