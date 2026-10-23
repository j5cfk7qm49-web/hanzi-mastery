import React, { useEffect, useRef, useState } from 'react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import type { Vocabulary } from '../core/schema';
import { updateVocabulary } from '../services/vocabulary';

export function VocabularyEditor({ plugin, id, initial, onSaved, onBusy, disabled }: {
  plugin: RNPlugin; id: string; initial: Vocabulary; onSaved(vocabulary: Vocabulary): void; onBusy?(busy: boolean): void; disabled?: boolean;
}) {
  const [traditional, setTraditional] = useState(initial.traditional), [simplified, setSimplified] = useState(initial.simplified || '');
  const [pinyin, setPinyin] = useState(initial.pinyin), [meaning, setMeaning] = useState(initial.meanings.join('; '));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const guard = useRef(false), live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  const save = async () => {
    if (guard.current || disabled) return; guard.current = true; setBusy(true); onBusy?.(true); setError(''); setStatus('');
    try {
      const draft: Vocabulary = { ...initial, traditional: traditional.trim(), simplified: simplified.trim() || undefined,
        pinyin: pinyin.trim(), meanings: meaning.split(';').map(s => s.trim()).filter(Boolean) };
      const saved = await updateVocabulary(plugin, id, JSON.parse(JSON.stringify(draft)));
      if (live.current) { setStatus('Vocabulary and linked study cards saved and read back.'); onSaved(saved); }
    } catch (e) { if (live.current) setError(e instanceof Error ? e.message : 'Vocabulary could not be updated.'); }
    finally { guard.current = false; if (live.current) { setBusy(false); onBusy?.(false); } }
  };
  return <section className="hm-word-editor" aria-label="Edit vocabulary">
    <h2>Word details</h2>
    <p className="hm-muted">Edits update linked study cards and keep their review histories.</p>
    <fieldset className="hm-form" disabled={busy || disabled}>
      <div className="hm-field-grid">
      <label>Traditional<input aria-label="Edit Traditional characters" value={traditional} onChange={e => setTraditional(e.target.value)} /></label>
      <label>Simplified (optional)<input aria-label="Edit Simplified form" value={simplified} onChange={e => setSimplified(e.target.value)} /></label>
      <label>Pinyin<input aria-label="Edit pinyin" value={pinyin} onChange={e => setPinyin(e.target.value)} /></label>
      </div>
      <label>Study meanings<textarea aria-label="Edit study meanings" value={meaning} onChange={e => setMeaning(e.target.value)} /></label>
      <button className="hm-primary" aria-label="Save vocabulary and update study cards" onClick={() => void save()}>Save changes</button>
    </fieldset>
    {error && <p role="alert" className="hm-error">{error}</p>}{status && <p role="status">{status}</p>}
    {initial.dictionary && <details><summary>Original dictionary sources</summary>
      <p>Study edits leave this imported source record intact.</p>
      <p><a href={initial.dictionary.moe.url} target="_blank" rel="noreferrer">{initial.dictionary.moe.provider}</a> · {initial.dictionary.moe.license}</p>
      <p>{initial.dictionary.moe.pinyin} · {initial.dictionary.moe.bopomofo}</p>
      <p>{initial.dictionary.moe.edition} · retrieved {initial.dictionary.importedAt}</p>
      <ul>{initial.dictionary.moe.definitions.map((text, i) => <li key={i}>{text}</li>)}</ul>
      {initial.dictionary.english && <><p><a href={initial.dictionary.english.url} target="_blank" rel="noreferrer">CC-CEDICT English</a> · {initial.dictionary.english.license}</p>
        <p>{initial.dictionary.english.snapshot}</p><ul>{initial.dictionary.english.definitions.map((text, i) => <li key={i}>{text}</li>)}</ul></>}
    </details>}
  </section>;
}
