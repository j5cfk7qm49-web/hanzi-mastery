import React, { useEffect, useState } from 'react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { readLibrary, addVocabularyMembership, ensureLibrary, type LibraryEntry } from '../services/library';
import { ensureCollection } from '../services/remnote';
import { ensureStudyCards } from '../services/cards';
import { STUDY_SKILLS, type StudySkill } from '../core/study';
import { SkillSelection } from './SkillSelection';

export function VocabularyLibrary({ plugin, listId, disabled, onOpen, onBusy }: {
  plugin: RNPlugin; listId: string; disabled?: boolean; onOpen(id: string): Promise<void>; onBusy?(busy: boolean): void;
}) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]), [search, setSearch] = useState(''), [selected, setSelected] = useState<string[]>([]);
  const [skills, setSkills] = useState<StudySkill[]>([...STUDY_SKILLS]), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [reload, setReload] = useState(0), [root, setRoot] = useState('');
  useEffect(() => {
    let live = true;
    setSelected([]);
    void Promise.all([readLibrary(plugin), plugin.storage.getSynced<string>('hm:v2:collection')])
      .then(([value, collection]) => { if (live) { setEntries(value); setRoot(collection || ''); setMessage(''); } })
      .catch(() => { if (live) setMessage('Could not load vocabulary. Refresh to retry.'); });
    return () => { live = false; };
  }, [plugin, reload, listId]);
  const shown = entries.filter(entry => (!listId || listId === root || entry.parentId === listId || entry.lists.includes(listId)) &&
    `${entry.vocabulary.traditional} ${entry.vocabulary.pinyin} ${entry.vocabulary.meanings.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const act = async (work: () => Promise<void>) => {
    if (busy || disabled) return; setBusy(true); onBusy?.(true); setMessage('');
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not finish. Retry.'); }
    finally { setBusy(false); onBusy?.(false); }
  };
  return <section aria-label="Vocabulary library"><h2>Vocabulary</h2>
    <label>Find a word<input value={search} onChange={event => setSearch(event.target.value)} /></label>
    <div className="hm-actions"><button disabled={busy || disabled} onClick={() => setReload(value => value + 1)}>Refresh vocabulary</button>
      <button disabled={busy || disabled || !shown.length} onClick={() => setSelected(shown.map(entry => entry.id))}>Select shown words</button></div>
    <p>{shown.length} {shown.length === 1 ? 'word' : 'words'} · {selected.length} selected</p>
    <SkillSelection value={skills} onChange={setSkills} disabled={busy || disabled} />
    <button disabled={busy || disabled || !selected.length} onClick={() => void act(async () => {
      const errors: string[] = [], vocabulary = entries.map(item => item.vocabulary);
      for (const entry of entries.filter(item => selected.includes(item.id))) {
        const failed = await ensureStudyCards(plugin, entry.id, entry.vocabulary, skills, { vocabulary });
        if (failed.length) errors.push(`${entry.vocabulary.traditional}: ${failed.join(' ')}`);
      }
      setMessage(errors.length ? errors.join(' ') : 'Selected skills added. Existing cards and paused directions are preserved.');
    })}>Add selected skills to selected words</button>
    <button disabled={busy || disabled} onClick={() => void act(async () => {
      const id = await ensureCollection(plugin), library = await ensureLibrary(plugin);
      for (const entry of entries) {
        await addVocabularyMembership(plugin, entry.id, id);
        await addVocabularyMembership(plugin, entry.id, library);
      }
      setMessage('All existing vocabulary is included in the master library. Cards and histories are unchanged.'); setReload(value => value + 1);
    })}>Include existing words in master library</button>
    {message && <p role="status">{message}</p>}
    {shown.map(entry => <article className="hm-import-row" key={entry.id}>
      <label className="hm-check"><input type="checkbox" checked={selected.includes(entry.id)} disabled={busy || disabled}
        onChange={event => setSelected(old => event.target.checked ? [...old, entry.id] : old.filter(id => id !== entry.id))} />
        <strong>{entry.vocabulary.traditional}</strong> {entry.vocabulary.pinyin} — {entry.vocabulary.meanings.join('; ')}</label>
      <button disabled={busy || disabled} onClick={() => void act(() => onOpen(entry.id))}>Edit {entry.vocabulary.traditional}</button>
    </article>)}
  </section>;
}
