import React, { useEffect, useRef, useState } from 'react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { importWords, lookupDictionary, type DictionaryLookup } from '../services/dictionary';
import { importDictionaryCandidate, prepareDictionaryImport } from '../services/vocabulary';
import { sortVocabularyList } from '../services/lists';
import { useImportDraft, type ImportRow, type ImportDraft } from './useImportDraft';
import { SkillSelection } from './SkillSelection';
import { DictionaryLinks } from './DictionaryLinks';

const rowFrom = (row: DictionaryLookup, review = false): ImportRow => {
  const selected = review && row.candidates.length > 1 ? -1 : row.candidates.findIndex(c => c.meanings.length > 0);
  return { ...row, selected, included: selected >= 0, meaning: selected >= 0 ? row.candidates[selected].meanings.join('; ') : '' };
};
const PAGE_SIZE = 25;
export function DictionaryImport({ plugin, disabled, parentId, onOpen, onBusy }: { plugin: RNPlugin; disabled?: boolean; parentId?: string; onOpen(id: string): Promise<void>; onBusy?(busy: boolean): void }) {
  const { draft, setDraft, ready, error: draftError, flush } = useImportDraft(plugin, parentId);
  const { text, rows, review, showInput, page, skills, findAudio } = draft;
  const field = <K extends keyof ImportDraft>(key: K, value: ImportDraft[K] | ((old: ImportDraft[K]) => ImportDraft[K])) =>
    setDraft(old => ({ ...old, [key]: typeof value === 'function' ? (value as (previous: ImportDraft[K]) => ImportDraft[K])(old[key]) : value }));
  const setText = (value: string) => field('text', value), setRows = (value: ImportRow[] | ((old: ImportRow[]) => ImportRow[])) => field('rows', value);
  const setReview = (value: boolean) => field('review', value), setShowInput = (value: boolean) => field('showInput', value);
  const setPage = (value: number | ((old: number) => number)) => field('page', value);
  const [phase, setPhase] = useState<'lookup' | 'import'>(), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [progress, setProgress] = useState({ completed: 0, total: 0 }), [stopping, setStopping] = useState(false);
  const busy = phase !== undefined, lookupAbort = useRef<AbortController>(), stopRequested = useRef(false);
  const cache = useRef(new Map<string, DictionaryLookup>()), guard = useRef(false), live = useRef(true);
  useEffect(() => () => { live.current = false; lookupAbort.current?.abort(); stopRequested.current = true; }, []);
  useEffect(() => { setStatus(''); setError(''); cache.current.clear(); }, [parentId]);
  const change = (i: number, update: Partial<ImportRow>) => setRows(old => old.map((row, j) => i === j ? { ...row, ...update } : row));
  const importRows = async (entries: ImportRow[]) => {
    setPhase('import');
    const selected = new Set(entries.filter(row => row.included && row.selected >= 0 && (!row.importedId || row.importError) && row.meaning.trim()));
    let completed = 0, succeeded = 0; setProgress({ completed, total: selected.size });
    const session = await prepareDictionaryImport(plugin, parentId);
    try {
      for (let i = 0; i < entries.length; i++) {
        if (stopRequested.current) break;
        const row = entries[i]; if (!selected.has(row)) continue;
        try {
          const saved = await importDictionaryCandidate(plugin, { ...row.candidates[row.selected], meanings: row.meaning.split(';').map(s => s.trim()).filter(Boolean) },
            { parentId: session.parentId, session, skills, findAudio });
          succeeded++;
          if (live.current) change(i, { importedId: saved.id, reused: saved.reused,
            meaning: saved.vocabulary?.meanings.join('; ') || row.meaning,
            importError: saved.cardErrors?.length ? saved.cardErrors.join(' ') : undefined, audioNotice: saved.audioNotice });
        } catch (e) { if (live.current) change(i, { importError: e instanceof Error ? e.message : 'Import failed; retry.' }); }
        completed++; if (live.current) setProgress({ completed, total: selected.size });
        if (completed % 25 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally { await sortVocabularyList(plugin, session.parentId); }
    const skipped = entries.filter(row => !row.pending && !row.importedId && (!row.included || row.selected < 0 || !row.meaning.trim())).length;
    if (live.current && succeeded && !stopRequested.current) setShowInput(false);
    if (live.current) setStatus(`${stopRequested.current ? 'Import stopped. ' : ''}${succeeded} entries imported or reused.${skipped ? ` ${skipped} skipped; see details below.` : ''}${completed < selected.size || succeeded < completed ? ' Import again to finish pending entries.' : ''} Card errors are shown per word.`);
  };
  const run = async (task: () => Promise<void>) => {
    if (guard.current || disabled || !ready) return; guard.current = true; onBusy?.(true); setError(''); setStatus(''); setStopping(false); stopRequested.current = false;
    try { await task(); } catch (e) { if (live.current) setError(e instanceof Error ? e.message : 'Import failed. Your completed entries are kept.'); }
    finally { guard.current = false; if (live.current) { setPhase(undefined); onBusy?.(false); } }
  };
  const lookup = () => run(async () => {
    setPhase('lookup');
    if (!plugin.rootURL) throw new Error('The bundled dictionary asset location is unavailable. Reopen the workbench and retry.');
    const controller = new AbortController(); lookupAbort.current = controller;
    const words = importWords(text), previous = new Map(rows.map(row => [row.word, row]));
    for (const row of rows) if (row.candidates.length) cache.current.set(row.word, row);
    const pending = words.filter(word => !cache.current.has(word));
    let completed = words.length - pending.length;
    let working = words.map(word => previous.get(word) || (cache.current.has(word) ? rowFrom(cache.current.get(word)!, review) :
      { ...rowFrom({ word, candidates: [] }), pending: true }));
    setProgress({ completed, total: words.length }); setPage(0); setRows(working);
    const received = new Set<string>();
    const receive = (result: DictionaryLookup) => {
      received.add(result.word); if (result.candidates.length) cache.current.set(result.word, result);
      completed++; working = working.map(row => row.word === result.word ? rowFrom(result, review) : row);
      if (live.current) { setRows(working); setProgress({ completed, total: words.length }); }
    };
    try {
      const results = pending.length ? await lookupDictionary(pending, plugin.rootURL, { signal: controller.signal, onResult: receive }) : [];
      for (const result of results) if (!received.has(result.word)) receive(result);
    } catch (e) { if (!controller.signal.aborted) throw e; }
    if (controller.signal.aborted) { setStatus(`Lookup stopped after ${completed} of ${words.length} words. Run again to resume; completed results are kept.`); return; }
    if (review) setStatus('Review readings and meanings, then import your selections.');
    else {
      // A previous optional preview can be continued in automatic mode.
      working = working.map(row => row.selected < 0 && !row.importedId && row.candidates.length ? rowFrom(row) : row);
      setRows(working); await importRows(working);
    }
  });
  const actionable = rows.some(row => row.included && row.selected >= 0 && row.meaning.trim() && (!row.importedId || row.importError));
  return <section className="hm-dictionary-import" aria-label="Dictionary import">
    <div className="hm-section-heading"><div><h2>Add words</h2><p className="hm-muted">Paste words. All study skills are selected by default.</p></div><span className="hm-badge">Dictionary import</span></div>
    {!ready && <p role="status">Loading saved import…</p>}{draftError && <p role="alert">{draftError}</p>}
    <SkillSelection value={skills} onChange={value => { field('skills', value); setRows(old => old.map(row => ({ ...row, importedId: undefined, importError: undefined }))); }} disabled={busy || disabled || !ready} />
    <p className="hm-caption">{rows.filter(row => row.included && row.selected >= 0).length} selected words · up to {rows.filter(row => row.included && row.selected >= 0).length * skills.length} scheduled cards. Existing cards are reused.</p>
    {rows.length > 0 && <button disabled={busy || disabled || !ready || !actionable} onClick={() => void run(() => importRows(rows))}>Resume import</button>}
    {!showInput && <button disabled={busy || disabled || !ready} onClick={() => setShowInput(true)}>Import more words</button>}
    <div hidden={!showInput}>
    <label>Words to look up<textarea value={text} disabled={busy || disabled || !ready} onChange={e => setText(e.target.value)} placeholder={'學習　朋友　中國\nOne word per line, or separate with spaces'} /></label>
    <div className="hm-import-controls"><button className="hm-primary" disabled={busy || disabled || !ready || !text.trim()} onClick={() => void lookup()}>{review ? 'Look up words' : 'Import words'}</button>
      <label className="hm-check"><input type="checkbox" checked={review} disabled={busy || disabled || !ready} onChange={e => setReview(e.target.checked)} />Review before importing</label></div>
    <label className="hm-check"><input type="checkbox" checked={findAudio} disabled={busy || disabled || !ready} onChange={e => field('findAudio', e.target.checked)} />Link matching word recordings</label>
    <p className="hm-caption">Uses bundled CC-CEDICT readings and English. Alternate readings and wording stay editable. Recording lookup sends unmatched words to Wiktionary and Wikimedia; audio loads when played.</p>
    </div>
    {busy && <><p role="status">{phase === 'lookup' ? 'Looking up' : 'Importing'} {progress.completed} of {progress.total} words…</p>
      <progress aria-label={phase === 'lookup' ? 'Dictionary lookup progress' : 'Dictionary import progress'} value={progress.completed} max={Math.max(1, progress.total)} />
      <button disabled={stopping} onClick={() => { setStopping(true); stopRequested.current = true; if (phase === 'lookup') lookupAbort.current?.abort(); }}>
        {stopping ? 'Stopping…' : phase === 'lookup' ? 'Stop lookup' : 'Stop import after current entry'}</button></>}
    {error && <p role="alert" className="hm-error">{error}</p>}{status && <p role="status" className="hm-notice">{status}</p>}
    {!!rows.length && (review || actionable) && <button disabled={busy || disabled || !ready || !actionable} onClick={() => void run(() => importRows(rows))}>Import selected words</button>}
    {rows.length > PAGE_SIZE && <nav aria-label="Import preview pages"><p>Showing {page * PAGE_SIZE + 1}–{Math.min(rows.length, (page + 1) * PAGE_SIZE)} of {rows.length} words</p>
      <button disabled={!page || !ready} onClick={() => setPage(p => p - 1)}>Previous preview page</button>{' '}
      <button disabled={!ready || (page + 1) * PAGE_SIZE >= rows.length} onClick={() => setPage(p => p + 1)}>Next preview page</button></nav>}
    <div className="hm-import-results">{rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row, offset) => { const i = page * PAGE_SIZE + offset; return <article key={row.word} className="hm-import-row" aria-label={`Import ${row.word}`}>
      <div className="hm-import-summary"><strong lang="zh-Hant">{row.word}</strong><div><span>{row.selected >= 0 ? row.candidates[row.selected].pinyin : 'Reading needed'}</span><p>{row.meaning || row.error || (row.pending ? 'Waiting for lookup…' : 'No matching English meaning. Edit to add one.')}</p>
        {row.importedId && <small>{row.reused ? 'Reused' : 'Created'}{row.importError ? ' · Some cards need retry' : ''}</small>}</div>
        {row.importedId && <button disabled={busy || disabled || !ready} onClick={() => void flush().then(() => onOpen(row.importedId!)).catch(e => setError(e instanceof Error ? e.message : 'Could not open the imported vocabulary.'))}>Edit imported {row.word}</button>}</div>
      {row.importError && <p role="alert" className="hm-error">{row.importError}</p>}
      {row.audioNotice && <p className="hm-caption">{row.audioNotice}</p>}
      <DictionaryLinks word={row.word} />
      {!row.importedId && !!row.candidates.length && <details open={review || undefined}><summary>Edit {row.word}{row.candidates.length > 1 ? ` · ${row.candidates.length} readings` : ''}</summary>
        <label>Reading for {row.word}<select disabled={busy || disabled || !ready} value={row.selected} onChange={e => { const selected = Number(e.target.value); change(i, { selected, included: selected >= 0, meaning: selected >= 0 ? row.candidates[selected].meanings.join('; ') : '' }); }}>
          <option value={-1}>Choose a reading</option>{row.candidates.map((c, j) => <option key={j} value={j}>{c.pinyin} — {c.meanings.join('; ') || 'English study meaning needed'}</option>)}
        </select></label>
        {row.selected >= 0 && <><label>Study meanings for {row.word}<textarea value={row.meaning} disabled={busy || disabled || !ready} onChange={e => change(i, { meaning: e.target.value })} /></label>
          <details><summary>Original dictionary entry for {row.word}</summary>{row.candidates[row.selected].dictionary.moe && <><a href={row.candidates[row.selected].dictionary.moe!.url} target="_blank" rel="noreferrer">MOE Revised via Moedict · CC BY-ND 3.0 TW</a>
            <ul>{row.candidates[row.selected].dictionary.moe!.definitions.map((d, j) => <li key={j}>{d}</li>)}</ul></>}
            <p>CC-CEDICT English · CC BY-SA 4.0</p><ul>{row.candidates[row.selected].dictionary.english?.definitions.map((d, j) => <li key={j}>{d}</li>)}</ul></details></>}
        <label className="hm-check"><input type="checkbox" checked={row.included} disabled={busy || disabled || !ready} onChange={e => change(i, { included: e.target.checked })} />Include {row.word}</label>
      </details>}
    </article>; })}</div>
    <details className="hm-import-sources"><summary>Dictionary sources & privacy</summary><p>Readings and English use bundled <a href="https://www.mdbg.net/chinese/dictionary?page=cedict" target="_blank" rel="noreferrer">CC-CEDICT</a> (CC BY-SA 4.0). Dictionary lookup stays local. Optional recording lookup uses local Shtooka and MOE audio indexes and sends missing words to Wiktionary and Wikimedia. Isolated characters can reuse the same syllable and tone. Audio loads from its provider when played, retaining its own credits and licence. Original definitions are retained separately from your edits.</p></details>
  </section>;
}
