import React, { useEffect, useState } from 'react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import type { Vocabulary } from '../core/schema';
import { STUDY_NAMES } from '../core/study';
import { defaultWritingPrompt } from '../core/study';
import { recallFront } from '../core/recall';
import { readStudyCards, writingFront, type CardEdit, type LinkedStudyCard } from '../services/cards';

export function CardEditor({ plugin, id, word, draft = word, edits, onChange, disabled, revision = 0 }: {
  plugin: RNPlugin; id: string; word: Vocabulary; draft?: Vocabulary; edits: Record<string, CardEdit>; onChange(edits: Record<string, CardEdit>): void; disabled?: boolean; revision?: number;
}) {
  const [cards, setCards] = useState<LinkedStudyCard[]>([]), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void readStudyCards(plugin, id).then(value => { if (live) { setCards(value); setError(''); } })
      .catch(() => { if (live) setError('Could not read linked cards. Reopen this word before changing card options.'); });
    return () => { live = false; };
  }, [plugin, id, revision]);
  const change = (cardId: string, patch: CardEdit) => onChange({ ...edits, [cardId]: { ...edits[cardId], ...patch } });
  return <section aria-label="Linked card previews"><h2>Cards</h2><p className="hm-muted">Shared word edits update every default card. Custom cues stay separate.</p>
    {error && <p role="alert">{error}</p>}
    {!cards.length && !error && <p>No study cards added yet.</p>}
    {cards.map(card => {
      const schema = card.schema, writing = schema.skill === 'writing', edit = edits[card.id] || {};
      const generated = writing ? writingFront(schema) : recallFront(schema);
      const inferred = card.front && card.front !== generated && (writing || !schema.bidirectional) ? writing ? card.front.replace(/^Write in (?:Traditional Chinese|Chinese):\s*/, '') : card.front : '';
      const custom = writing ? (schema.customPrompt ?? schema.prompt !== defaultWritingPrompt(word)) ? schema.prompt : inferred : schema.customPrompt || inferred;
      const prompt = edit.prompt ?? custom ?? '';
      const audio = !writing && (schema.customAudio ?? (!!schema.referenceAudio && schema.referenceAudio !== word.audio?.[0])) ? schema.referenceAudio || '' : '';
      const preview = writing ? writingFront({ ...schema, traditional: draft.traditional, simplified: draft.simplified, prompt: prompt || defaultWritingPrompt(draft) }) :
        prompt || recallFront({ ...schema, traditional: draft.traditional, pinyin: draft.pinyin, meaning: draft.meanings.join('; ') });
      return <article className="hm-card-editor" key={card.id} aria-label={`${STUDY_NAMES[schema.skill]} card`}>
        <strong>{schema.skill !== 'writing' && schema.bidirectional ? 'Translation ↔' : STUDY_NAMES[schema.skill]}</strong>
        <span className="hm-badge">{(edit.direction ?? card.direction) === 'none' ? 'Paused' : 'Active'}</span>
        {card.outsideWord && <p className="hm-muted">Stored outside this word. Move this card beneath the word in RemNote to include it in the word’s lists.</p>}
        <p>{preview}</p><p className="hm-muted">Answer: {writing || schema.bidirectional ? draft.traditional : `${draft.traditional} — ${draft.pinyin} — ${draft.meanings.join('; ')}`}</p>
        {!writing && schema.bidirectional && <p className="hm-muted">Reverse: {edit.reversePrompt || schema.reversePrompt || draft.traditional} → {draft.meanings.join('; ')}</p>}
        {card.nativeAnswerChanged && <label><input type="checkbox" checked={!!edit.restoreAnswer} disabled={disabled}
          onChange={event => change(card.id, { restoreAnswer: event.target.checked })} />Restore word answer (answer was edited in RemNote)</label>}
        <details><summary>{prompt ? 'Custom prompt' : 'Customize prompt'}</summary>
          <label>Custom prompt for {STUDY_NAMES[schema.skill]}<input value={prompt} disabled={disabled} placeholder="Use word default"
            onChange={event => change(card.id, { prompt: event.target.value })} /></label>
          <button type="button" disabled={disabled} onClick={() => change(card.id, { prompt: '' })}>Use word default</button>
          {!writing && schema.bidirectional && <label>Custom reverse prompt<input value={edit.reversePrompt ?? schema.reversePrompt ?? ''} disabled={disabled}
            onChange={event => change(card.id, { reversePrompt: event.target.value })} /></label>}
        </details>
        {!writing && (schema.skill === 'listening' || schema.skill === 'pronunciation') && <details><summary>{(edit.audio ?? audio) ? 'Custom audio' : 'Customize audio'}</summary>
          <label>Custom audio for {STUDY_NAMES[schema.skill]}<input value={edit.audio ?? audio} disabled={disabled} placeholder="Use shared reference audio"
            onChange={event => change(card.id, { audio: event.target.value })} /></label></details>}
        <label>Practice directions<select value={edit.direction ?? card.direction} disabled={disabled} onChange={event => change(card.id, { direction: event.target.value as CardEdit['direction'] })}>
          <option value="none">Paused</option><option value="forward">Forward</option>
          {!writing && schema.bidirectional && <><option value="backward">Backward</option><option value="both">Both directions</option></>}
        </select></label>
      </article>;
    })}
  </section>;
}
