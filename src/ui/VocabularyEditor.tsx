import React, { useEffect, useRef, useState } from 'react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import type { Vocabulary } from '../core/schema';
import { updateVocabulary } from '../services/vocabulary';
import { CardEditor } from './CardEditor';
import type { CardEdit } from '../services/cards';
import { validateVocabulary } from '../core/vocabulary';
import { DictionaryLinks } from './DictionaryLinks';
import { RecordingCredit } from './RecordingCredit';
import { findRecording } from '../services/recordings';
import { recordingMatches } from '../core/recordings';

export function VocabularyEditor({ plugin, id, initial, onSaved, onBusy, disabled }: {
  plugin: RNPlugin; id: string; initial: Vocabulary; onSaved(vocabulary: Vocabulary): void; onBusy?(busy: boolean): void; disabled?: boolean;
}) {
  const [traditional, setTraditional] = useState(initial.traditional), [simplified, setSimplified] = useState(initial.simplified || '');
  const [pinyin, setPinyin] = useState(initial.pinyin), [meaning, setMeaning] = useState(initial.meanings.join('; '));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [audio, setAudio] = useState(initial.audio?.[0] || ''), [edits, setEdits] = useState<Record<string, CardEdit>>({}), [revision, setRevision] = useState(0);
  const [audioSource, setAudioSource] = useState(initial.audioSource);
  const [characterAction, setCharacterAction] = useState('');
  const [ready, setReady] = useState(false);
  const guard = useRef(false), live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  useEffect(() => {
    void plugin.storage.getSynced<{ word: Vocabulary; edits: Record<string, CardEdit> }>(`hm:v6:edit-draft:${id}`).then(pending => {
      if (!live.current) return;
      if (pending) {
        validateVocabulary(pending.word);
        setTraditional(pending.word.traditional); setSimplified(pending.word.simplified || ''); setPinyin(pending.word.pinyin);
        setMeaning(pending.word.meanings.join('; ')); setAudio(pending.word.audio?.[0] || ''); setAudioSource(pending.word.audioSource); setEdits(pending.edits);
        setStatus('Some card updates are unfinished. Save changes to finish.');
      }
      setReady(true);
    }).catch(() => { if (live.current) setError('Could not check unfinished edits. Reopen this word to retry.'); });
  }, [plugin, id]);
  const save = async () => {
    if (guard.current || disabled || !ready) return; guard.current = true; setBusy(true); onBusy?.(true); setError(''); setStatus('');
    try {
      const draft: Vocabulary = { ...initial, traditional: traditional.trim(), simplified: simplified.trim() || undefined,
        pinyin: pinyin.trim(), meanings: meaning.split(';').map(s => s.trim()).filter(Boolean), audio: audio.trim() ? [audio.trim()] : [], audioSource };
      if (draft.traditional !== initial.traditional && characterAction !== 'correction') throw new Error('Choose Correct this entry, or use Add more words for a different word.');
      const saved = await updateVocabulary(plugin, id, JSON.parse(JSON.stringify(draft)), edits);
      if (live.current) { setAudio(saved.audio?.[0] || ''); setAudioSource(saved.audioSource); setStatus('Vocabulary and linked study cards saved and read back.'); setEdits({}); setRevision(value => value + 1); onSaved(saved); }
    } catch (e) { if (live.current) setError(e instanceof Error ? e.message : 'Vocabulary could not be updated.'); }
    finally { guard.current = false; if (live.current) { setBusy(false); onBusy?.(false); } }
  };
  const findAudio = async () => {
    if (guard.current || disabled || !ready || !plugin.rootURL) return;
    guard.current = true; setBusy(true); onBusy?.(true); setError(''); setStatus('Finding a matching recording…');
    try {
      const source = await findRecording({ traditional: traditional.trim(), simplified: simplified.trim() || undefined, pinyin: pinyin.trim() }, plugin.rootURL);
      if (live.current) {
        if (source) { setAudio(source.url); setAudioSource(source); setStatus('Recording found. Save changes to update linked cards.'); }
        else setStatus('No matching recording found.');
      }
    } catch { if (live.current) { setStatus(''); setError('Recording lookup unavailable. Retry or enter an audio URL.'); } }
    finally { guard.current = false; if (live.current) { setBusy(false); onBusy?.(false); } }
  };
  return <section className="hm-word-editor" aria-label="Edit vocabulary">
    <h2>Word details</h2>
    <p className="hm-muted">Edits update linked study cards and keep their review histories.</p>
    <DictionaryLinks word={traditional.trim()} />
    {!ready && !error && <p role="status">Loading word edits…</p>}
    <fieldset className="hm-form" disabled={busy || disabled || !ready}>
      <div className="hm-field-grid">
      <label>Traditional<input aria-label="Edit Traditional characters" value={traditional} onChange={e => setTraditional(e.target.value)} /></label>
      <label>Simplified (optional)<input aria-label="Edit Simplified form" value={simplified} onChange={e => setSimplified(e.target.value)} /></label>
      <label>Pinyin<input aria-label="Edit pinyin" value={pinyin} onChange={e => setPinyin(e.target.value)} /></label>
      </div>
      <label>Study meanings<textarea aria-label="Edit study meanings" value={meaning} onChange={e => setMeaning(e.target.value)} /></label>
      <label>Shared reference audio URL<input type="url" value={audio} onChange={event => setAudio(event.target.value)} placeholder="https://…" /></label>
      <button disabled={!plugin.rootURL || !pinyin.trim()} onClick={() => void findAudio()}>Find matching recording</button>
      {audioSource?.url === audio && recordingMatches(audioSource, { traditional: traditional.trim(), pinyin }) && <>
        <RecordingCredit source={audioSource} />
        {audioSource.recordedForm && audioSource.recordedForm !== traditional.trim() && <p className="hm-caption">Recording of {audioSource.recordedForm} with the same pronunciation.</p>}
      </>}
      {traditional.trim() !== initial.traditional && <label><input type="checkbox" checked={characterAction === 'correction'}
        onChange={event => setCharacterAction(event.target.checked ? 'correction' : '')} />Correct this entry and keep its history. Use Add more words for a different word.</label>}
      <CardEditor plugin={plugin} id={id} word={initial} draft={{ ...initial, traditional, simplified, pinyin, meanings: meaning.split(';').map(value => value.trim()).filter(Boolean) }} edits={edits} onChange={setEdits} disabled={busy || disabled} revision={revision} />
      <button className="hm-primary" aria-label="Save vocabulary and update study cards" onClick={() => void save()}>Save changes</button>
    </fieldset>
    {error && <p role="alert" className="hm-error">{error}</p>}{status && <p role="status">{status}</p>}
    {initial.dictionary && <details><summary>Original dictionary sources</summary>
      <p>Study edits leave this imported source record intact.</p>
      {initial.dictionary.moe && <><p><a href={initial.dictionary.moe.url} target="_blank" rel="noreferrer">{initial.dictionary.moe.provider}</a> · {initial.dictionary.moe.license}</p>
      <p>{initial.dictionary.moe.pinyin} · {initial.dictionary.moe.bopomofo}</p>
      <p>{initial.dictionary.moe.edition} · retrieved {initial.dictionary.importedAt}</p>
      <ul>{initial.dictionary.moe.definitions.map((text, i) => <li key={i}>{text}</li>)}</ul></>}
      {initial.dictionary.english && <><p><a href={initial.dictionary.english.url} target="_blank" rel="noreferrer">CC-CEDICT English</a> · {initial.dictionary.english.license}</p>
        <p>{initial.dictionary.english.snapshot}</p><ul>{initial.dictionary.english.definitions.map((text, i) => <li key={i}>{text}</li>)}</ul></>}
    </details>}
  </section>;
}
