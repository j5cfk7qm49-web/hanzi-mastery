import React, { useEffect, useRef, useState } from 'react';
import { renderWidget, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from '../core/config';
import { characters, parseWritingSchema, SETTINGS_KEY, VOCAB_POWERUP, SCHEMA_SLOT, type Vocabulary } from '../core/schema';
import { createWritingCard, ensureCollection } from '../services/remnote';
import { loadCharacter } from '../services/characters';
import type { CharacterJson } from 'hanzi-writer';
import { WriterCanvas } from '../ui/WriterCanvas';
import { StudySkills } from '../ui/StudySkills';
import { WidgetBoundary } from '../ui/WidgetBoundary';
import '../ui/styles.css';
export function Workbench() {
  const plugin = usePlugin();
  const [traditional, setTraditional] = useState(''), [simplified, setSimplified] = useState('');
  const [pinyin, setPinyin] = useState(''), [meaning, setMeaning] = useState('');
  const [category, setCategory] = useState(''), [source, setSource] = useState('Manual');
  const [vocabId, setVocabId] = useState(''), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), guard = useRef(false), created = useRef('');
  const [initializing, setInitializing] = useState(true);
  const pendingCard = useRef(''), needsVocabularySetup = useRef(true);
  const [createdCard, setCreatedCard] = useState('');
  const [referenceAudio, setReferenceAudio] = useState<string>();
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
          const v = JSON.parse(await rem.getPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT)) as Vocabulary;
          if (!live) return;
          characters(v.traditional); setVocabId(rem._id); created.current = rem._id;
          needsVocabularySetup.current = false;
          setTraditional(v.traditional); setSimplified(v.simplified || ''); setPinyin(v.pinyin); setMeaning(v.meanings.join('; '));
          setCategory(v.categories.join('; ')); setSource(v.source); setStatus('Using the focused vocabulary entry.');
          setReferenceAudio(v.audio?.[0]);
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
    const chars = characters(traditional);
    if (simplified) characters(simplified);
    if (!meaning.trim() || /\p{Script=Han}/u.test(meaning)) throw new Error('Use an English prompt without Chinese characters.');
    parseWritingSchema(JSON.stringify({ version:2, skill:'writing', vocabularyId:'pending', traditional,
      ...(simplified ? {simplified} : {}), prompt: meaning.trim() + (pinyin.trim() ? ` (${pinyin.trim()})` : '') }));
    // Validate availability before creating anything.
    if (withWritingData) await Promise.all([...chars, ...Array.from(simplified)].map(c => loadCharacter(c, plugin.rootURL)));
    const collection = await ensureCollection(plugin);
    let id = created.current;
    if (!id) {
      const rem = await plugin.rem.createRem();
      if (!rem) throw new Error('RemNote could not create the vocabulary entry.');
      id = rem._id; created.current = id; setVocabId(id);
    }
    if (needsVocabularySetup.current) {
      const vocab: Vocabulary = { version: 2, traditional, ...(simplified ? { simplified } : {}), pinyin,
        meanings: meaning.split(';').map(s => s.trim()).filter(Boolean), source,
        categories: category.split(';').map(s => s.trim()).filter(Boolean) };
      const rem = await plugin.rem.findOne(id);
      if (!rem) throw new Error('The new vocabulary entry is unavailable.');
      await rem.setParent(collection);
      await rem.setText([[traditional, pinyin.trim(), meaning.trim()].filter(Boolean).join(' — ')]);
      await rem.addPowerup(VOCAB_POWERUP);
      await rem.setPowerupProperty(VOCAB_POWERUP, SCHEMA_SLOT, [JSON.stringify(vocab)]);
      needsVocabularySetup.current = false;
    }
    return { id, collection };
  };
  const create = () => run(async () => {
    const { id, collection } = await prepareVocabulary(true);
    const cardId = await createWritingCard(plugin, { version: 2, skill: 'writing', vocabularyId: id, traditional,
      ...(simplified ? { simplified } : {}), prompt: meaning.trim() + (pinyin.trim() ? ` (${pinyin.trim()})` : '') },
      { parentId: collection, resumeId: pendingCard.current || undefined, onCreate: newId => { pendingCard.current = newId; } });
    setCreatedCard(cardId);
    setStatus('Created a forward writing card in the Hanzi Mastery document. Open it and use RemNote’s native practice action.');
  });
  const saveVocabulary = () => run(async () => {
    await prepareVocabulary(false);
    setStatus('Vocabulary is ready. Choose pinyin, tone, listening or spoken-practice cards below.');
  });
  const startPractice = () => run(async () => {
    const chars = characters(settings.script === 'simplified' ? simplified : traditional);
    const data = await Promise.all(chars.map(c => loadCharacter(c, plugin.rootURL))); setPractice({ chars, data }); setIndex(0);
  });
  return <section className="hm">
    <header><h1>Hanzi Mastery workbench</h1><button onClick={() => void plugin.widget.closePopup()}>Close</button></header>
    <p>Create a writing card with a hidden target and an English prompt. Practice here never changes tested mastery.</p>
    {error && <p role="alert" className="hm-error">{error}</p>}
    {status && <p role="status">{status}</p>}
    {initializing && <p role="status">Loading settings and vocabulary…</p>}
    <fieldset className="hm-form" disabled={busy || initializing || !!createdCard || (!!vocabId && !needsVocabularySetup.current)}>
    <label>Traditional characters <input value={traditional} onChange={e => { setTraditional(e.target.value); setPractice(undefined); }} disabled={!!vocabId} /></label>
    <label>Optional explicit Simplified form <input value={simplified} onChange={e => setSimplified(e.target.value)} disabled={!!vocabId} /></label>
    <label>Pinyin (optional; included in writing prompt) <input value={pinyin} onChange={e => setPinyin(e.target.value)} /></label>
    <label>English meaning / writing prompt <input value={meaning} onChange={e => setMeaning(e.target.value)} /></label>
    <label>Categories, separated by semicolons <input value={category} onChange={e => setCategory(e.target.value)} disabled={!!vocabId} /></label>
    <label>Source <input value={source} onChange={e => setSource(e.target.value)} disabled={!!vocabId} /></label>
    </fieldset>
    <div className="hm-actions"><button className="hm-primary" disabled={busy || initializing || !!createdCard} onClick={() => void create()}>Create linked writing card</button>
      <button disabled={busy || initializing || !!vocabId} onClick={() => void saveVocabulary()}>Save vocabulary for other skills</button>
      <button disabled={busy || initializing} onClick={() => void startPractice()}>Practice selected characters</button></div>
    {createdCard && <button className="hm-primary" disabled={busy} onClick={() => void run(async () => {
      const rem = await plugin.rem.findOne(createdCard);
      if (!rem) throw new Error('The created card could not be opened.');
      await plugin.window.openRem(rem); await plugin.widget.closePopup();
    })}>Open created writing card</button>}
    {vocabId && !needsVocabularySetup.current && !busy && <StudySkills key={vocabId} plugin={plugin} vocabularyId={vocabId}
      traditional={traditional} pinyin={pinyin} meaning={meaning} audio={referenceAudio} />}
    {practice && <><h2>Practice: {practice.chars[index]}</h2><WriterCanvas key={settings.animationSpeed} character={practice.chars[index]} data={practice.data[index]} mode="learn" active settings={settings} generation={index}
      onCorrect={() => {}} onMistake={() => {}} onComplete={() => {}} onError={() => setError('Practice canvas could not start.')} />
      <button onClick={() => setIndex(i => (i+1)%practice.chars.length)}>Next character</button>
      <p><a href={`plecoapi://x-callback-url/s?q=${encodeURIComponent(practice.chars[index])}`}>Look up in Pleco</a> · <a href="https://stroke-order.learningweb.moe.edu.tw/" target="_blank" rel="noreferrer">Taiwan MOE stroke reference</a></p></>}
    <details><summary>Settings</summary><p>Thresholds are fractions. Recognition leniency is separate from first-attempt accuracy. Settings apply to the next loaded card.</p>
      <label>Settings JSON <textarea disabled={busy || initializing} rows={18} value={settingsText} onChange={e => setSettingsText(e.target.value)} /></label>
      <button disabled={busy || initializing} onClick={() => void run(async () => {
        const next = parseSettings(JSON.parse(settingsText)); await plugin.storage.setSynced(SETTINGS_KEY, next);
        const confirmed = parseSettings(await plugin.storage.getSynced(SETTINGS_KEY));
        if (JSON.stringify(confirmed) !== JSON.stringify(next)) throw new Error('Settings save was not confirmed. Your edits are preserved; retry before closing.');
        setSettings(confirmed); setStatus('Settings saved and read back.');
      })}>Save settings</button></details>
  </section>;
}
renderWidget(() => <WidgetBoundary><Workbench /></WidgetBoundary>);
