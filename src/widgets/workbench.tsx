import React, { useEffect, useRef, useState } from 'react';
import { renderWidget, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from '../core/config';
import { characters, parseWritingSchema, SETTINGS_KEY, VOCAB_POWERUP, SCHEMA_SLOT, type Vocabulary } from '../core/schema';
import { resolveListParent, vocabularyParent } from '../services/lists';
import { RECALL_POWERUP } from '../core/recall';
import { WRITING_POWERUP } from '../core/schema';
import { loadCharacter } from '../services/characters';
import type { CharacterJson } from 'hanzi-writer';
import { WriterCanvas } from '../ui/WriterCanvas';
import { StudySkills } from '../ui/StudySkills';
import { DictionaryImport } from '../ui/DictionaryImport';
import { VocabularyEditor } from '../ui/VocabularyEditor';
import { VocabularyLists } from '../ui/VocabularyLists';
import { readVocabulary, validateVocabulary, createVocabularyEntry } from '../services/vocabulary';
import { ensureWritingCard, ensureStudyCards } from '../services/cards';
import { STUDY_SKILLS, type StudySkill } from '../core/study';
import { SkillSelection } from '../ui/SkillSelection';
import { VocabularyLibrary } from '../ui/VocabularyLibrary';
import { WidgetBoundary } from '../ui/WidgetBoundary';
import { StudyPacks } from '../studyPacks/StudyPacks';
import '../ui/styles.css';
export function Workbench() {
  const plugin = usePlugin();
  const [traditional, setTraditional] = useState(''), [simplified, setSimplified] = useState('');
  const [pinyin, setPinyin] = useState(''), [meaning, setMeaning] = useState('');
  const [category, setCategory] = useState(''), [source, setSource] = useState('Manual');
  const [vocabId, setVocabId] = useState(''), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), guard = useRef(false), created = useRef('');
  const [initializing, setInitializing] = useState(true);
  const needsVocabularySetup = useRef(true);
  const [createdCard, setCreatedCard] = useState('');
  const [referenceAudio, setReferenceAudio] = useState<string>();
  const [editable, setEditable] = useState<Vocabulary>(), [revision, setRevision] = useState(0);
  const [childBusy, setChildBusy] = useState(false);
  const [listId, setListId] = useState('');
  const [view, setView] = useState<'import' | 'manual' | 'word' | 'cards' | 'settings' | 'library' | 'packs'>('import');
  const [skills, setSkills] = useState<StudySkill[]>([...STUDY_SKILLS]), [separate, setSeparate] = useState(false);
  const useVocabulary = (id: string, v: Vocabulary, parentId?: string) => {
    setVocabId(id); created.current = id; needsVocabularySetup.current = false;
    setTraditional(v.traditional); setSimplified(v.simplified || ''); setPinyin(v.pinyin); setMeaning(v.meanings.join('; '));
    setCategory(v.categories.join('; ')); setSource(v.source); setReferenceAudio(v.audio?.[0]); setEditable(v); setRevision(r => r + 1);
    setView('word');
    if (parentId !== undefined) setListId(parentId);
  };
  const [settings, setSettings] = useState(DEFAULT_SETTINGS), [settingsText, setSettingsText] = useState('');
  const [practice, setPractice] = useState<{ chars: string[]; data: CharacterJson[] }>();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const configured = parseSettings(await plugin.storage.getSynced(SETTINGS_KEY));
        if (!live) return; setSettings(configured); setSettingsText(JSON.stringify(configured, null, 2));
        const context = await plugin.widget.getWidgetContext<WidgetLocation.Popup>();
        const rem = await plugin.rem.findOne(context.contextData?.sourceRemId);
        if (rem && await rem.hasPowerup(VOCAB_POWERUP)) {
          const v = await readVocabulary(plugin, rem._id);
          if (!live) return;
          const parent = await vocabularyParent(plugin, rem._id);
          if (!live) return;
          characters(v.traditional); useVocabulary(rem._id, v, parent); setStatus('Using the focused vocabulary entry.');
        } else if (rem) {
          const code = await rem.hasPowerup(RECALL_POWERUP) ? RECALL_POWERUP : await rem.hasPowerup(WRITING_POWERUP) ? WRITING_POWERUP : undefined;
          if (code) {
            const metadata = JSON.parse(await rem.getPowerupProperty(code, SCHEMA_SLOT));
            const v = await readVocabulary(plugin, metadata.vocabularyId), parent = await vocabularyParent(plugin, metadata.vocabularyId);
            if (live) useVocabulary(metadata.vocabularyId, v, parent);
          } else {
            const parent = await resolveListParent(plugin, rem._id);
            if (live) setListId(parent);
          }
        }
      } catch { if (live) setError('Could not load saved settings or vocabulary metadata. No data has been changed.'); }
      finally { if (live) setInitializing(false); }
    })();
    return () => { live = false; };
  }, [plugin]);
  const run = async (task: () => Promise<void>) => {
    if (initializing || guard.current) return; guard.current = true; setBusy(true); setError('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed.'); }
    finally { guard.current = false; setBusy(false); }
  };
  const prepareVocabulary = async (withWritingData: boolean) => {
    const vocab: Vocabulary = { version: 2, traditional, ...(simplified ? { simplified } : {}), pinyin,
      meanings: meaning.split(';').map(s => s.trim()).filter(Boolean), source,
      categories: category.split(';').map(s => s.trim()).filter(Boolean) };
    validateVocabulary(vocab);
    const chars = characters(traditional);
    if (simplified) characters(simplified);
    if (!meaning.trim() || /\p{Script=Han}/u.test(meaning)) throw new Error('Use an English prompt without Chinese characters.');
    parseWritingSchema(JSON.stringify({ version:2, skill:'writing', vocabularyId:'pending', traditional,
      ...(simplified ? {simplified} : {}), prompt: meaning.trim() + (pinyin.trim() ? ` (${pinyin.trim()})` : '') }));
    // Validate availability before creating anything.
    if (withWritingData) await Promise.all([...chars, ...Array.from(simplified)].map(c => loadCharacter(c, plugin.rootURL)));
    const collection = await resolveListParent(plugin, listId);
    let id = created.current;
    if (needsVocabularySetup.current) {
      const saved = await createVocabularyEntry(plugin, vocab, { parentId: collection, separate, resumeId: id || undefined,
        onCreate: newId => { created.current = newId; } });
      id = saved.id; created.current = id;
      needsVocabularySetup.current = false;
      setVocabId(id); setEditable(saved.vocabulary);
      setTraditional(saved.vocabulary.traditional); setSimplified(saved.vocabulary.simplified || ''); setPinyin(saved.vocabulary.pinyin); setMeaning(saved.vocabulary.meanings.join('; '));
      setListId(collection);
    }
    return { id, collection };
  };
  const create = () => run(async () => {
    const { id } = await prepareVocabulary(true);
    const current = await readVocabulary(plugin, id);
    const cardId = await ensureWritingCard(plugin, { version: 2, skill: 'writing', vocabularyId: id, traditional: current.traditional,
      ...(current.simplified ? { simplified: current.simplified } : {}), prompt: current.meanings.join('; ') + (current.pinyin.trim() ? ` (${current.pinyin.trim()})` : '') });
    setCreatedCard(cardId);
    setView('cards'); setStatus(`Writing card added beneath ${traditional}.`);
  });
  const saveVocabulary = () => run(async () => {
    const { id } = await prepareVocabulary(false);
    const errors = await ensureStudyCards(plugin, id, await readVocabulary(plugin, id), skills);
    setView('cards'); setStatus(errors.length ? `Word saved. ${errors.join(' ')}` : 'Word and selected study cards saved.');
  });
  const startPractice = () => run(async () => {
    const chars = characters(settings.script === 'simplified' ? simplified : traditional);
    const data = await Promise.all(chars.map(c => loadCharacter(c, plugin.rootURL))); setPractice({ chars, data }); setIndex(0);
  });
  return <section className="hm hm-workbench hm-popup" aria-label="Hanzi Mastery workbench window" tabIndex={0}>
    <header><div><h1>Hanzi Mastery</h1><p className="hm-caption">Build your vocabulary. Practice every skill.</p></div><button onClick={() => void plugin.widget.closePopup()}>Close</button></header>
    <fieldset className="hm-form">
    {error && <p role="alert" className="hm-error">{error}</p>}
    {status && <p role="status">{status}</p>}
    {initializing && <p role="status">Loading settings and vocabulary…</p>}
    {view !== 'packs' && <VocabularyLists plugin={plugin} selectedId={listId} vocabularyId={vocabId || undefined} disabled={busy || initializing || childBusy} onSelected={setListId} onBusy={setChildBusy} />}
    <nav className="hm-tabs" aria-label="Workbench pages">{[['import', 'Import'], ['library', 'Vocabulary'], ...(vocabId ? [['word', 'Word'], ['cards', 'Study cards']] : [['manual', 'Manual entry']]), ['packs', 'Midterm / course study'], ['settings', 'Settings']].map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} disabled={busy || initializing || childBusy} onClick={() => { setView(id as typeof view); setStatus(''); setError(''); }}>{label}</button>)}</nav>
    {vocabId && view !== 'settings' && view !== 'packs' && <div className="hm-word-heading"><strong lang="zh-Hant">{traditional}</strong><div><span>{pinyin}</span><p>{meaning}</p></div></div>}
    <div className="hm-workbench-page">
    {view === 'packs' && <StudyPacks plugin={plugin} storage={plugin.storage} assetRoot={plugin.rootURL} settings={settings} />}
    <div hidden={view !== 'import'}><DictionaryImport plugin={plugin} parentId={listId} disabled={busy || initializing || childBusy} onBusy={setChildBusy} onOpen={async id => {
      const v = await readVocabulary(plugin, id);
      useVocabulary(id, v); setCreatedCard(''); setStatus('Editing the imported vocabulary.');
    }} /></div>
    {view === 'library' && <VocabularyLibrary plugin={plugin} listId={listId} disabled={busy || initializing || childBusy} onBusy={setChildBusy}
      onOpen={async id => { useVocabulary(id, await readVocabulary(plugin, id)); setCreatedCard(''); }} />}
    {vocabId && (view === 'word' || view === 'cards') && <button disabled={busy || childBusy} onClick={() => setView('import')}>Back to import</button>}
    {editable && view === 'word' && <VocabularyEditor key={vocabId} plugin={plugin} id={vocabId} initial={editable} disabled={busy || initializing || childBusy} onBusy={setChildBusy} onSaved={v => useVocabulary(vocabId, v)} />}
    {view === 'manual' && <fieldset className="hm-form" disabled={busy || initializing || childBusy || !!createdCard}>
    <h2>Add a word manually</h2><div className="hm-field-grid">
    <label>Traditional<input aria-label="Traditional characters" value={traditional} onChange={e => { setTraditional(e.target.value); setPractice(undefined); }} disabled={!!vocabId} /></label>
    <label>Simplified (optional)<input aria-label="Optional explicit Simplified form" value={simplified} onChange={e => setSimplified(e.target.value)} disabled={!!vocabId} /></label>
    <label>Pinyin (optional)<input aria-label="Pinyin (optional; included in writing prompt)" value={pinyin} onChange={e => setPinyin(e.target.value)} /></label>
    </div>
    <label>English meaning / writing prompt <input value={meaning} onChange={e => setMeaning(e.target.value)} /></label>
    <SkillSelection value={skills} onChange={setSkills} disabled={busy || initializing || childBusy} />
    <label className="hm-check"><input type="checkbox" checked={separate} onChange={event => setSeparate(event.target.checked)} />Create a separate entry instead of reusing a matching word</label>
    <details><summary>Source & categories</summary><label>Categories, separated by semicolons <input value={category} onChange={e => setCategory(e.target.value)} disabled={!!vocabId} /></label>
    <label>Source <input value={source} onChange={e => setSource(e.target.value)} disabled={!!vocabId} /></label>
    </details></fieldset>}
    {(view === 'manual' || view === 'cards') && <><div className="hm-actions"><button className="hm-primary" aria-label="Create linked writing card" disabled={busy || initializing || childBusy || !!createdCard} onClick={() => void create()}>Add writing card</button>
      {!editable && <button aria-label="Save vocabulary for other skills" disabled={busy || initializing || childBusy || !!vocabId} onClick={() => void saveVocabulary()}>Save word</button>}
      <button aria-label="Practice selected characters" disabled={busy || initializing || childBusy} onClick={() => void startPractice()}>Practice</button></div>
    {createdCard && <button className="hm-primary" disabled={busy || childBusy} onClick={() => void run(async () => {
      const rem = await plugin.rem.findOne(createdCard);
      if (!rem) throw new Error('The created card could not be opened.');
      await plugin.window.openRem(rem); await plugin.widget.closePopup();
    })}>Open created writing card</button>}
    {vocabId && !needsVocabularySetup.current && !busy && <fieldset className="hm-form" disabled={childBusy}><StudySkills key={`${vocabId}:${revision}`} plugin={plugin} vocabularyId={vocabId}
      traditional={traditional} pinyin={pinyin} meaning={meaning} audio={referenceAudio} audioSource={editable?.audioSource} onBusy={setChildBusy} /></fieldset>}</>}
    {!!vocabId && view !== 'settings' && view !== 'packs' && <button className="hm-add-more" disabled={busy || childBusy} onClick={() => {
      created.current = ''; needsVocabularySetup.current = true;
      setVocabId(''); setEditable(undefined); setCreatedCard(''); setTraditional(''); setSimplified(''); setPinyin(''); setMeaning('');
      setCategory(''); setSource('Manual'); setReferenceAudio(undefined); setStatus(''); setError(''); setPractice(undefined);
      setView('import');
    }} aria-label="New vocabulary / dictionary import">Add more words</button>}
    {practice && (view === 'cards' || view === 'manual') && <><h2>Practice: {practice.chars[index]}</h2><WriterCanvas key={settings.animationSpeed} character={practice.chars[index]} data={practice.data[index]} mode="learn" active settings={settings} generation={index}
      onCorrect={() => {}} onMistake={() => {}} onComplete={() => {}} onError={() => setError('Practice canvas could not start.')} />
      <button onClick={() => setIndex(i => (i+1)%practice.chars.length)}>Next character</button>
      <p><a href={`plecoapi://x-callback-url/s?q=${encodeURIComponent(practice.chars[index])}`}>Look up in Pleco</a> · <a href="https://stroke-order.learningweb.moe.edu.tw/" target="_blank" rel="noreferrer">Taiwan MOE stroke reference</a></p></>}
    {view === 'settings' && <><h2>Writing preferences</h2><p className="hm-muted">Applies to the next loaded card.</p>
      <fieldset className="hm-form" disabled={busy || initializing || childBusy}>
      <label>Writing script<select value={settings.script} onChange={e => { const next = { ...settings, script: e.target.value as Settings['script'] }; setSettings(next); setSettingsText(JSON.stringify(next, null, 2)); }}><option value="traditional">Traditional</option><option value="simplified">Explicit Simplified</option></select></label>
      <label>Animation speed<select value={settings.animationSpeed} onChange={e => { const next = { ...settings, animationSpeed: Number(e.target.value) }; setSettings(next); setSettingsText(JSON.stringify(next, null, 2)); }}>{[.5, 1, 1.5, 2, ...(![.5, 1, 1.5, 2].includes(settings.animationSpeed) ? [settings.animationSpeed] : [])].map(n => <option key={n} value={n}>{n}×</option>)}</select></label>
      <label className="hm-check"><input type="checkbox" checked={settings.geometryFeedback} onChange={e => { const next = { ...settings, geometryFeedback: e.target.checked }; setSettings(next); setSettingsText(JSON.stringify(next, null, 2)); }} />Show stroke geometry feedback</label>
      <details><summary>Advanced settings</summary><p className="hm-caption">Recognition leniency and mastery thresholds are independent.</p><label>Settings JSON <textarea rows={18} value={settingsText} onChange={e => setSettingsText(e.target.value)} /></label></details>
      <button disabled={busy || initializing || childBusy} onClick={() => void run(async () => {
        const next = parseSettings(JSON.parse(settingsText)); await plugin.storage.setSynced(SETTINGS_KEY, next);
        const confirmed = parseSettings(await plugin.storage.getSynced(SETTINGS_KEY));
        if (JSON.stringify(confirmed) !== JSON.stringify(next)) throw new Error('Settings save was not confirmed. Your edits are preserved; retry before closing.');
        setSettings(confirmed); setStatus('Settings saved and read back.');
      })}>Save settings</button></fieldset></>}
    </div>
    </fieldset>
  </section>;
}
renderWidget(() => <WidgetBoundary><Workbench /></WidgetBoundary>);
