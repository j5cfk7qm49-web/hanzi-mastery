import React, { useEffect, useRef, useState } from 'react';
import { checkRecall, parsePinyin, RECALL_NAMES, type RecallResult, type RecallSchema } from '../core/recall';
import { SkillRepository, type SkillHistory, type SkillRecord } from '../services/recall';
import { ReferenceAudio } from './ReferenceAudio';
import { PronunciationRecorder } from './PronunciationRecorder';

export interface RecallExerciseProps {
  context: { cardId: string; schema: RecallSchema }; repository: SkillRepository;
  revealed: boolean; suspended?: boolean; isCurrent(allowRevealed?: boolean): Promise<boolean>;
}
const toneNames = ['1 — level', '2 — rising', '3 — dipping', '4 — falling', '5 — neutral'];
export function RecallExercise({ context, repository, revealed, suspended, isCurrent }: RecallExerciseProps) {
  const { schema } = context, syllables = parsePinyin(schema.pinyin);
  const [mode, setMode] = useState<'ready'|'test'|'result'|'practice'>('ready');
  const [answer, setAnswer] = useState(''), [tones, setTones] = useState<number[]>(syllables.map(() => 0));
  const [heard, setHeard] = useState(false), [recorded, setRecorded] = useState(false);
  const [result, setResult] = useState<RecallResult>(), [history, setHistory] = useState<SkillHistory>();
  const [saveState, setSaveState] = useState<'idle'|'saving'|'saved'|'failed'>('idle');
  const [checking, setChecking] = useState(false), [error, setError] = useState('');
  const live = useRef(true), active = useRef(false), done = useRef(false), saving = useRef(false);
  const guard = useRef(false), operation = useRef(0), record = useRef<SkillRecord>();
  const host = useRef({ isCurrent, revealed, suspended }); host.current = { isCurrent, revealed, suspended };
  useEffect(() => {
    let current = true;
    void repository.load(schema).then(value => { if (current) setHistory(value); })
      .catch(() => { if (current) setError('Saved skill results could not be loaded. Retry by reopening this review; existing data has not been changed.'); });
    return () => { current = false; live.current = false; operation.current++; active.current = false; };
  }, [repository, context.cardId]);
  const finish = (value: RecallResult) => {
    if (!active.current || done.current) return;
    active.current = false; done.current = true; operation.current++;
    record.current = { id: crypto.randomUUID(), at: Date.now(), cardId: context.cardId, result: value };
    setResult(value); setMode('result'); setChecking(false);
  };
  const fail = (failure: 'answer-revealed'|'forgotten') => finish({ passed: false, accuracy: 0,
    spellingCorrect: 0, tonesCorrect: 0, total: syllables.length,
    assessment: schema.skill === 'pronunciation' ? 'self' : 'checked', failure });
  useEffect(() => { if (revealed && active.current) fail('answer-revealed'); }, [revealed]);
  const start = async () => {
    if (guard.current || done.current || !history || revealed || suspended) return;
    guard.current = true; setChecking(true); setError(''); const token = ++operation.current;
    try {
      const current = await host.current.isCurrent(false);
      if (!live.current || token !== operation.current) return;
      if (!current || host.current.revealed || host.current.suspended) { setError('The hidden current card could not be confirmed. Try again when it is ready.'); return; }
      active.current = true; setMode('test');
    } catch { if (live.current) setError('RemNote could not confirm this review. Retry before starting.'); }
    finally { guard.current = false; if (live.current) setChecking(false); }
  };
  const submit = async (selfPassed?: boolean) => {
    if (guard.current || !active.current || host.current.suspended || done.current ||
        (schema.skill === 'listening' && !heard) ||
        (schema.skill === 'pronunciation' && (!recorded || (selfPassed && !heard)))) return;
    guard.current = true; setChecking(true); setError(''); const token = operation.current;
    try {
      const current = await host.current.isCurrent(false);
      if (!live.current || token !== operation.current || !active.current) return;
      if (host.current.revealed) { fail('answer-revealed'); return; }
      if (!current || host.current.suspended) { setError('This is no longer the confirmed current review. Your answer is preserved.'); return; }
      finish(schema.skill === 'pronunciation' ? { passed: !!selfPassed, accuracy: selfPassed ? 1 : 0,
        spellingCorrect: 0, tonesCorrect: 0, total: syllables.length, assessment: 'self' } :
        checkRecall(schema, schema.skill === 'tones' ? tones : answer));
    } catch { if (live.current) setError('The current review could not be checked. Your answer is preserved; retry.'); }
    finally { guard.current = false; if (live.current) setChecking(false); }
  };
  const save = async () => {
    if (!record.current || saving.current || saveState === 'saved') return;
    saving.current = true; setSaveState('saving');
    try {
      const next = await repository.save(schema, record.current);
      if (live.current) { setHistory(next); setSaveState('saved'); setError(''); }
    } catch { if (live.current) { setSaveState('failed'); setError('Skill-result save was not confirmed. Keep this result open and retry.'); } }
    finally { saving.current = false; }
  };
  useEffect(() => { if (result) void save(); }, [result]);
  const disabled = !!suspended || checking || revealed;
  const referenceVisible = schema.skill === 'listening' || (schema.skill === 'pronunciation' && recorded) || mode === 'practice';
  return <section className="hm hm-review" aria-label="Hanzi Mastery study review">
    <header><h1>Hanzi Mastery</h1><span className="hm-badge">{RECALL_NAMES[schema.skill]}</span></header>
    {schema.skill !== 'listening' && <h2 className="hm-target" lang="zh-Hant">{schema.traditional}</h2>}
    {error && <p role="alert" className="hm-error">{error}</p>}
    {suspended && <p role="status">Waiting for RemNote. Your answer is preserved.</p>}
    {!history && !error && <p role="status">Loading skill results…</p>}
    {mode === 'ready' && <>
      <p>{schema.skill === 'pinyin' ? 'Recall the complete pinyin, including every tone.' :
        schema.skill === 'tones' ? 'Identify the dictionary tone of every syllable. No tracing is needed.' :
        schema.skill === 'listening' ? 'Listen, then type the dictionary pinyin including tones. Connected speech may sound different; you can replay the reference.' :
        'Say the word from memory, record your first attempt, then listen and compare. You assess your pronunciation yourself.'}</p>
      <div className="hm-actions"><button className="hm-primary" disabled={disabled || !history} onClick={() => void start()}>Begin {schema.skill === 'pronunciation' ? 'spoken practice' : 'recall test'}</button>
        <button onClick={() => { if (!guard.current) { operation.current++; setMode('practice'); } }}>Study with answer</button></div>
      {revealed && <p className="hm-muted">The answer is already visible. Study is available; testing is disabled.</p>}
    </>}
    {mode !== 'ready' && schema.skill === 'pronunciation' && <PronunciationRecorder
      disabled={!!suspended || checking || (mode === 'test' && revealed) || mode === 'result'} onReady={() => setRecorded(true)} />}
    {referenceVisible && mode !== 'ready' && <ReferenceAudio text={schema.traditional} url={schema.referenceAudio}
      disabled={!!suspended || checking || (mode === 'test' && revealed)} onPlayed={() => setHeard(true)} />}
    {mode === 'test' && schema.skill !== 'pronunciation' && <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); void submit(); }}>
      {schema.skill === 'tones' ? <fieldset className="hm-form" disabled={disabled}>
        {syllables.map((s, i) => <label key={i}>Tone for {s.base} (syllable {i + 1})<select aria-label={`Tone for syllable ${i + 1}`} value={tones[i]}
          onChange={e => { const value = Number(e.target.value); setTones(old => old.map((t, j) => i === j ? value : t)); }}>
          <option value={0}>Choose a tone</option>{toneNames.map((name, t) => <option key={t} value={t + 1}>{name}</option>)}</select></label>)}
      </fieldset> : <><label>Your pinyin<input aria-label="Your pinyin" value={answer} disabled={disabled} autoComplete="off" autoCapitalize="none" spellCheck={false}
        onChange={e => setAnswer(e.target.value)} placeholder="Enter pinyin with tones" /></label>
        <p className="hm-muted">Separate syllables with spaces. ü, v and u: are equivalent. An unmarked syllable means neutral tone (5).</p></>}
      {schema.skill === 'listening' && !heard && <p className="hm-muted">Play the reference to the end before checking your answer.</p>}
      <button className="hm-primary" type="submit" disabled={disabled || (schema.skill === 'tones' ? tones.some(t => !t) : !answer.trim()) || (schema.skill === 'listening' && !heard)}>Check first answer</button>
    </form>}
    {mode === 'test' && schema.skill === 'pronunciation' && recorded && <>
      <p>Reference pinyin: <b>{schema.pinyin}</b></p><p>Compare your recording with the reference. These are self-assessed results.</p>
      <div className="hm-actions"><button disabled={disabled || !heard} onClick={() => void submit(true)}>I pronounced it correctly</button>
        <button disabled={disabled} onClick={() => void submit(false)}>Needs practice</button></div>
      {!heard && <p className="hm-muted">Listen to the reference before marking your pronunciation correct.</p>}
    </>}
    {mode === 'test' && <button className="hm-danger" disabled={disabled} onClick={() => fail('forgotten')}>I don’t know — end test</button>}
    {(result || mode === 'practice') && <div className={`hm-result ${result?.passed ? 'hm-pass' : result ? 'hm-fail' : ''}`} role="status">
      {result && <><h2>{result.assessment === 'self' ? 'Spoken practice: self-assessed' : result.passed ? 'Correct on the first answer' : 'Recall test needs practice'}</h2>
        {result.assessment === 'checked' && <p>{result.spellingCorrect}/{result.total} syllables spelled correctly · {result.tonesCorrect}/{result.total} tones correct</p>}
        {result.failure && <p>{result.failure === 'answer-revealed' ? 'The native answer was revealed before completion.' : 'Independent recall was not completed.'}</p>}
        <p>{saveState === 'saved' ? 'Skill result saved and read back.' : saveState === 'saving' ? 'Saving skill result…' : 'Skill result has not been saved.'}</p>
        {saveState === 'failed' && <button onClick={() => void save()}>Retry skill-result save</button>}
        <p>Suggested RemNote rating: <b>{result.passed ? 'Good / Recalled' : 'Again / Forgot'}</b>. Use RemNote’s native controls to submit it.</p>
      </>}
      <p lang="zh-Hant"><b>{schema.traditional}</b> — {schema.pinyin}</p><p>{schema.meaning}</p>
      <p>Dictionary tones: {syllables.map(s => s.tone).join(' · ')}. Connected speech may change how tones sound.</p>
      {!result && <p>Study only. This does not save a test result.</p>}
      {result && mode !== 'practice' && <button onClick={() => setMode('practice')}>Study with the reference</button>}
    </div>}
    {history && <p className="hm-muted"><small>{RECALL_NAMES[schema.skill]}: {history.passed}/{history.attempts} successful tests for this item and reading.
      {schema.skill === 'pronunciation' && ' Spoken results are self-assessed.'} Each skill has its own RemNote schedule; these counts do not promote writing mastery.</small></p>}
  </section>;
}
