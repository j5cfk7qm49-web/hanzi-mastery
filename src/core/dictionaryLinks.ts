import { characters } from './schema';

export function dictionaryWordUrl(word: string): string {
  characters(word);
  return `https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=${encodeURIComponent(word)}`;
}

export function wiktionaryWordUrl(word: string): string {
  characters(word);
  return `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#Chinese`;
}
