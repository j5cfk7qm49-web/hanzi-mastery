import React, { useEffect, useRef, useState } from 'react';
import type { CharacterJson, StrokeData } from 'hanzi-writer';
import { LEVEL_NAMES, type Settings } from '../core/config';
import { addStroke, failRecall, gradeAttempt, markLastAccidental, newAttempt, type Attempt, type Grade, type Result, type RecallFailure } from '../core/attempt';
import type { Mastery } from '../core/mastery';
import { geometryFeedback } from '../core/geometry';
import { MasteryRepository } from '../services/persistence';
import { loadCharacter } from '../services/characters';
import { WriterCanvas } from './WriterCanvas';
export interface ExerciseContext { cardId: string; vocabularyId: string; chars: string[]; prompt: string }
export interface ExerciseProps {
  context: ExerciseContext; settings: Settings; repository: MasteryRepository;
  revealed: boolean; isCurrent(allowRevealed?: boolean): Promise<boolean>;
}
interface Outcome { character: string; result: Result; attempt: Attempt }
export function ReviewExercise({ context, settings, repository, revealed, isCurrent }: ExerciseProps) {
  const [loaded, setLoaded] = useState<{ data: CharacterJson[]; progress: Mastery[] }>();
  const [error, setError] = useState(''), [reload, setReload] = useState(0);
  const [mode, setMode] = useState<'ready' | 'test' | 'learn' | 'result'>('ready');
  const [index, setIndex] = useState(0), [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState<Attempt>();
  const attemptRef = useRef<Attempt>();
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const outcomesRef = useRef<Outcome[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [grade, setGrade] = useState<Grade>('Again');
  const [diagnostics, setDiagnostics] = useState<ReturnType<typeof geometryFeedback>[]>([]);
  const active = useRef(false), live = useRef(true), saving = useRef(false);
  const id = useRef(crypto.randomUUID()), completedAt = useRef(0);
  const checkCurrent = useRef(isCurrent); checkCurrent.current = isCurrent;
  const revealedRef = useRef(revealed); revealedRef.current = revealed;
  const startGuard = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; active.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false; setLoaded(undefined); setError('');
    void Promise.all([
      Promise.all(context.chars.map(loadCharacter)),
      Promise.all(context.chars.map(c => repository.load(context.vocabularyId, c))),
    ]).then(([data, progress]) => { if (!cancelled) setLoaded({ data, progress }); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load writing exercise.'); });
    return () => { cancelled = true; active.current = false; };
  }, [context, repository, reload]);
  const update = (next: Attempt) => { attemptRef.current = next; setAttempt(next); };
  const summarize = (list: Outcome[]) => {
    active.current = false; completedAt.current = Date.now();
    outcomesRef.current = list; setOutcomes(list); setMode('result');
    const passed = list.length === context.chars.length && list.every(o => o.result.passed);
    setGrade(!passed ? 'Again' : list.some(o => o.result.suggestedGrade === 'Hard') ? 'Hard' : 'Good');
  };
  const finish = (failure?: RecallFailure) => {
    if (!active.current || !loaded || !attemptRef.current) return;
    const current = failure ? failRecall(attemptRef.current, failure) : attemptRef.current;
    update(current);
    const level = loaded.progress[index].level;
    const result = gradeAttempt(current, level, settings.thresholds[level]);
    const next = [...outcomesRef.current, { character: context.chars[index], attempt: current, result }];
    if (failure || index === context.chars.length-1) summarize(next);
    else {
      outcomesRef.current = next; setOutcomes(next);
      setIndex(index+1); update(newAttempt(loaded.data[index+1].strokes.length)); setVersion(v => v+1);
    }
  };
  useEffect(() => { if (revealed && active.current) finish('answer-revealed'); }, [revealed]);
  const start = async () => {
    if (!loaded || startGuard.current) return;
    startGuard.current = true;
    try {
      if (revealedRef.current || !await checkCurrent.current(false)) {
        setError('Testing is unavailable after answer reveal, during lookback, or after changing cards. Use guided practice.'); return;
      }
      if (!live.current || revealedRef.current) return;
      update(newAttempt(loaded.data[0].strokes.length)); active.current = true;
      setMode('test'); setError(''); setVersion(v => v+1);
    } catch { if (live.current) setError('The current review could not be verified. Testing is blocked.'); }
    finally { startGuard.current = false; }
  };
  const stroke = (data: StrokeData, type: 'accepted' | 'rejected') => {
    if (!active.current || !attemptRef.current || data.character !== context.chars[index]) return;
    if (revealedRef.current) { finish('answer-revealed'); return; }
    const next = addStroke(attemptRef.current, data.strokeNum, type);
    update(next);
    if (type === 'accepted' && settings.geometryFeedback && loaded) {
      const feedback = geometryFeedback(data.drawnPath.points, loaded.data[index].medians[data.strokeNum]);
      setDiagnostics(d => [...d, feedback]);
    }
  };
  const save = async () => {
    if (saving.current || saveState === 'saved' || !outcomesRef.current.length) return;
    saving.current = true; setSaveState('saving'); setError('');
    try {
      // A completed review may be saved after revealing its answer, but never on another card.
      if (!await checkCurrent.current()) throw new Error('This card is no longer eligible for saving. Keep native review controls available.');
      // Repeated characters within a word yield one record with their worst result.
      const unique = new Map<string, Outcome>();
      for (const o of outcomesRef.current) {
        const old = unique.get(o.character);
        if (!old || (old.result.passed && !o.result.passed) || (old.result.passed === o.result.passed && o.result.accuracy < old.result.accuracy)) unique.set(o.character, o);
      }
      for (const o of unique.values()) {
        if (!live.current) return;
        await repository.save(context.vocabularyId, o.character, { id: id.current + ':' + o.character,
          at: completedAt.current, cardId: context.cardId, character: o.character, result: o.result, source: 'test' }, settings);
      }
      if (live.current) setSaveState('saved');
    } catch (e) { if (live.current) { setSaveState('failed'); setError(e instanceof Error ? e.message : 'Mastery could not be saved. Retry before leaving this card.'); } }
    finally { saving.current = false; }
  };
  useEffect(() => { if (mode === 'result' && saveState === 'idle') void save(); }, [mode]);
  const guided = () => {
    if (active.current) { finish('guided-practice'); return; }
    setMode('learn'); setIndex(0); setVersion(v => v+1);
  };
  const resultVisible = outcomes.length > 0 && (mode === 'result' || mode === 'learn');
  const passed = outcomes.length === context.chars.length && outcomes.every(o => o.result.passed);
  const currentLevel = loaded?.progress[index].level || 0;
  const currentScore = attempt && gradeAttempt(attempt, currentLevel, settings.thresholds[currentLevel]);
  const last = attempt?.events.at(-1);
  const accidentAvailable = mode === 'test' && last?.type === 'rejected' && !last.accidental && !attempt?.completed &&
    (attempt?.events.filter(e => e.accidental).length || 0) < settings.accidentLimit;
  return <section className="hm" aria-label="Hanzi Mastery handwriting review">
    <header><h1>Hanzi Mastery</h1><span className="hm-badge">{mode === 'learn' ? 'Guided practice' : 'Writing review'}</span></header>
    <h2>{context.prompt}</h2>
    <div className="hm-meta"><span>{LEVEL_NAMES[currentLevel]} · required {Math.round(settings.thresholds[currentLevel]*100)}%</span>
      <span>Character {index+1} / {context.chars.length}</span><span>{settings.script === 'traditional' ? 'Traditional' : 'Simplified'}</span></div>
    {error && <div role="alert" className="hm-error">{error}</div>}
    {!loaded && !error && <p role="status">Loading stroke data and mastery…</p>}
    {!loaded && error && <button onClick={() => setReload(v => v+1)}>Retry loading</button>}
    {loaded && mode === 'ready' && <>
      <p>Recall every stroke independently. Corrections reduce first-attempt accuracy. A forgotten stroke or answer reveal fails the test.</p>
      <div className="hm-actions"><button className="hm-primary" disabled={revealed} onClick={() => void start()}>Begin test</button>
      <button onClick={guided}>Guided practice only</button></div>
      {revealed && <p className="hm-muted">The native answer is already visible. Practice is available; testing is disabled.</p>}
    </>}
    {loaded && (mode === 'test' || mode === 'learn') && <>
      {mode === 'learn' && <p className="hm-muted">Practice does not advance mastery or submit an SRS grade. Target: {context.chars[index]}</p>}
      <WriterCanvas character={context.chars[index]} data={loaded.data[index]} mode={mode} active settings={settings} generation={version}
        onCorrect={d => stroke(d, 'accepted')} onMistake={d => stroke(d, 'rejected')}
        onComplete={() => { if (attemptRef.current?.completed) finish(); }}
        onError={() => { active.current = false; setMode('ready'); setError('The handwriting engine could not start. No result was graded.'); }} />
      {mode === 'learn' && context.chars.length > 1 && <button onClick={() => { setIndex(i => (i+1)%context.chars.length); setVersion(v => v+1); }}>Next practice character</button>}
    </>}
    {mode === 'test' && attempt && currentScore && <>
      <progress value={attempt.events.filter(e => e.type === 'accepted').length} max={attempt.totalStrokes} aria-label="Completed strokes" />
      <p aria-live="polite">{attempt.events.filter(e => e.type === 'accepted').length} / {attempt.totalStrokes} strokes · {currentScore.mistakes} rejected attempts</p>
      <p>Current first-attempt accuracy: {currentScore.firstAttempts} / {attempt.totalStrokes} ({Math.round(currentScore.accuracy*100)}%). Unfinished strokes are pending.</p>
      <div className="hm-actions"><button className="hm-danger" onClick={() => finish('forgotten-stroke')}>I forgot a stroke — end test</button>
        <button disabled={!accidentAvailable} onClick={() => update(markLastAccidental(attemptRef.current!, settings.accidentLimit))}>Last input was accidental</button>
        <button onClick={guided}>End test for guided practice</button></div>
      <small>Accident correction applies only to the latest rejected input within 8 seconds, before drawing again. Limit {settings.accidentLimit} per character. Original errors stay in the record.</small>
    </>}
    {resultVisible && <div className={`hm-result ${passed ? 'hm-pass' : 'hm-fail'}`} role="status">
      <h2>{passed ? 'Passed this writing test' : 'Writing test failed'}</h2>
      {outcomes.map((o, i) => <p key={i}>{o.character}: {o.result.firstAttempts}/{o.result.totalStrokes} first attempts · {Math.round(o.result.accuracy*100)}% / {Math.round(o.result.threshold*100)}% required
        {o.result.accidents > 0 && ` · raw ${Math.round(o.result.rawAccuracy*100)}%, ${o.result.accidents} declared accident(s)`}
        {o.result.failure && ` · ${o.result.failure.replaceAll('-', ' ')}`}</p>)}
      <p>Suggested RemNote rating: <b>{!passed ? 'Again' : outcomes.some(o => o.result.suggestedGrade === 'Hard') ? 'Hard' : 'Good'}</b></p>
      <label>Your rating choice <select value={grade} onChange={e => setGrade(e.target.value as Grade)}>{(['Again','Hard','Good','Easy'] as Grade[]).map(g => <option key={g}>{g}</option>)}</select></label>
      <p className="hm-muted">Select <b>{grade}</b> with RemNote’s native rating controls. This selector records your intention on screen; it does not submit a rating or alter this writing result.</p>
      <p>{saveState === 'saved' ? 'Writing mastery saved and read back.' : saveState === 'saving' ? 'Saving writing mastery…' : 'Writing mastery has not been saved.'}</p>
      {saveState === 'failed' && <button onClick={() => void save()}>Retry mastery save</button>}
      {mode === 'result' && <button onClick={guided}>Practice with hints and animation</button>}
      {settings.geometryFeedback && diagnostics.filter(Boolean).length > 0 && <p className="hm-muted">Experimental path diagnostic: mean reference-path deviation {(diagnostics.reduce((sum,d) => sum+(d?.trajectoryError || 0),0)/diagnostics.length*100).toFixed(1)}% of canvas coordinates. This is feedback only, not a penmanship grade.</p>}
    </div>}
    <p className="hm-muted"><small>Mastery requires separate review days with at least {settings.minSpacingHours} hours between qualifying tests. RemNote controls scheduling.</small></p>
  </section>;
}
