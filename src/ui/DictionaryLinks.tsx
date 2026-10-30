import React from 'react';
import { dictionaryWordUrl, wiktionaryWordUrl } from '../core/dictionaryLinks';

export function DictionaryLinks({ word }: { word: string }) {
  try {
    return <p className="hm-caption"><a href={dictionaryWordUrl(word)} target="_blank" rel="noreferrer">CC-CEDICT: {word}</a>
      {' · '}<a href={wiktionaryWordUrl(word)} target="_blank" rel="noreferrer">Wiktionary</a></p>;
  } catch { return null; }
}
