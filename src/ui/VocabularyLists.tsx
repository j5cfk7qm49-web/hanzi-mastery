import React, { useEffect, useRef, useState } from 'react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { createVocabularyList, moveVocabularyToList, readVocabularyLists, resolveListParent, vocabularyParent, type VocabularyList } from '../services/lists';

export function VocabularyLists({ plugin, selectedId, vocabularyId, disabled, onSelected, onBusy }: {
  plugin: RNPlugin; selectedId: string; vocabularyId?: string; disabled?: boolean; onSelected(id: string): void; onBusy?(busy: boolean): void;
}) {
  const [lists, setLists] = useState<VocabularyList[]>([]), [name, setName] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const live = useRef(true), guard = useRef(false), draft = useRef(''), request = useRef(0);
  useEffect(() => () => { live.current = false; request.current++; }, []);
  useEffect(() => {
    const token = ++request.current;
    void readVocabularyLists(plugin, selectedId).then(value => { if (live.current && token === request.current) { setLists(value); setError(''); } })
      .catch(() => { if (live.current && token === request.current) setError('Could not read list bullets. Refresh from RemNote to retry.'); });
  }, [plugin, selectedId]);
  const run = async (task: () => Promise<void>) => {
    if (guard.current || disabled) return; guard.current = true; setBusy(true); onBusy?.(true); setError(''); setStatus('');
    try { await task(); }
    catch (e) { if (live.current) setError(e instanceof Error ? e.message : 'List action failed.'); }
    finally { guard.current = false; if (live.current) { setBusy(false); onBusy?.(false); } }
  };
  const selection = selectedId || lists[0]?.id || '';
  return <section className="hm-vocabulary-lists" aria-label="Vocabulary lists">
    <label>List<select aria-label="List bullet" value={selection} disabled={disabled || busy || !lists.length} onChange={e => onSelected(e.target.value)}>
      {lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
    </select></label>
    <details><summary>Manage lists</summary><p className="hm-caption">List → character or word → study cards. Focus any ordinary RemNote bullet to use it as a list.</p>
    <div className="hm-actions"><button disabled={disabled || busy} onClick={() => void run(async () => {
      const id = vocabularyId ? await vocabularyParent(plugin, vocabularyId) : selectedId;
      const found = await readVocabularyLists(plugin, id);
      if (live.current) { setLists(found); onSelected(found.some(list=>list.id===id) ? id : found[0]?.id || ''); setStatus('List bullets refreshed from RemNote.'); }
    })}>Refresh lists from RemNote</button>
    <button disabled={disabled || busy} onClick={() => void run(async () => {
      const id = await resolveListParent(plugin, selection), rem = await plugin.rem.findOne(id);
      if (rem) { await plugin.window.openRem(rem); await plugin.widget.closePopup(); }
    })}>Open selected list</button></div>
    <label>New list name<input value={name} disabled={disabled || busy} onChange={e => setName(e.target.value)} placeholder="Lesson 1" /></label>
    <button disabled={disabled || busy || !name.trim()} onClick={() => void run(async () => {
      const id = await createVocabularyList(plugin, name, { resumeId: draft.current || undefined, onCreate: created => { draft.current = created; } });
      draft.current = '';
      if (live.current) { setName(''); onSelected(id); setStatus('Created and selected a list bullet in Hanzi Mastery.'); }
    })}>Create list bullet</button>
    {vocabularyId && <><p className="hm-muted">To change this vocabulary’s list, select its destination and move the entry together with its linked cards.</p>
      <button disabled={disabled || busy} onClick={() => void run(async () => {
        const id = await moveVocabularyToList(plugin, vocabularyId, selection);
        if (live.current) { onSelected(id); setStatus('Vocabulary and linked cards moved and confirmed. Native review history is retained.'); }
      })}>Move vocabulary and cards to selected list</button></>}
    </details>
    {error && <p role="alert" className="hm-error">{error}</p>}{status && <p role="status">{status}</p>}
  </section>;
}
