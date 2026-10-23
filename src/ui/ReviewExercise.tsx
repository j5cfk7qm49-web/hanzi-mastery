import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CharacterJson, StrokeData } from 'hanzi-writer';
import { LEVEL_NAMES, type Settings } from '../core/config';
import { addStroke, failRecall, gradeAttempt, markLastAccidental, newAttempt, type Attempt, type Grade, type Result, type RecallFailure } from '../core/attempt';
import type { Mastery } from '../core/mastery';
import { geometryFeedback } from '../core/geometry';
import { MasteryRepository } from '../services/persistence';
import { loadCharacter } from '../services/characters';
import { WriterCanvas, type WriterCanvasControls } from './WriterCanvas';
import { ReviewSheet } from './ReviewSheet';
import { ReviewStart } from './ReviewStart';
import { useRevealInHost } from './useRevealInHost';
import { createId } from '../core/ids';
import { ReviewResult } from './ReviewResult';
export interface WritingSummary { id: string; at: number; passed: boolean; accuracy: number; total: number; failure?: RecallFailure }
export interface ExerciseContext { cardId: string; vocabularyId: string; chars: string[]; prompt: string }
export interface ExerciseProps {
  context: ExerciseContext; settings: Settings; repository: MasteryRepository;
  assetRoot?: string;
  suspended?: boolean;
  revealed: boolean; isCurrent(allowRevealed?: boolean): Promise<boolean>;
  fitToCard?: boolean;
  skillLabel?: string;
  regionLabel?: string;
  onSaveResult?(summary: WritingSummary): Promise<void>;
}
interface Outcome { character: string; result: Result; attempt: Attempt }
export function ReviewExercise({ context, settings, repository, revealed, isCurrent, assetRoot, suspended = false, fitToCard = false, skillLabel = 'Writing', regionLabel = 'Hanzi Mastery handwriting review', onSaveResult }: ExerciseProps) {
  const [loaded, setLoaded] = useState<{ data: CharacterJson[]; progress: Mastery[] }>();
  const [error, setError] = useState(''), [reload, setReload] = useState(0);
  const [mode, setMode] = useState<'ready' | 'test' | 'learn' | 'result'>('ready');
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const getResultHeading = useCallback(() => resultHeading.current, []);
  useRevealInHost(getResultHeading, mode === 'result' && !fitToCard, 0, 'start');
  const [sheet, setSheet] = useState(false), [canvasReady, setCanvasReady] = useState(false);
  const closeSheet = useCallback(() => setSheet(false), []);
  const practiceControls = useRef<WriterCanvasControls>(null);
  const [index, setIndex] = useState(0), [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState<Attempt>();
  const attemptRef = useRef<Attempt>();
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const outcomesRef = useRef<Outcome[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [grade, setGrade] = useState<Grade>('Again');
  const [diagnostics, setDiagnostics] = useState<ReturnType<typeof geometryFeedback>[]>([]);
  const [inputNotice, setInputNotice] = useState('');
  const [engineProblem, setEngineProblem] = useState(false);
  const [checking, setChecking] = useState(false);
  const [, tickAccidentDeadline] = useState(0);
  const active = useRef(false), live = useRef(true), saving = useRef(false);
  const id = useRef(createId()), completedAt = useRef(0);
  const checkCurrent = useRef(isCurrent); checkCurrent.current = isCurrent;
  const revealedRef = useRef(revealed); revealedRef.current = revealed;
  const startGuard = useRef(false);
  const controlVersion = useRef(0);
  useEffect(() => { live.current = true; return () => { live.current = false; active.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false; setLoaded(undefined); setError('');
    void Promise.all([
      Promise.all(context.chars.map(c => loadCharacter(c, assetRoot))),
      Promise.all(context.chars.map(c => repository.load(context.vocabularyId, c))),
    ]).then(([data, progress]) => { if (!cancelled) setLoaded({ data, progress }); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load writing exercise.'); });
    return () => { cancelled = true; active.current = false; };
  }, [context, repository, reload]);
  const update = (next: Attempt) => { attemptRef.current = next; setAttempt(next); };
  const summarize = (list: Outcome[], practice = false) => {
    controlVersion.current++;
    active.current = false; completedAt.current = Date.now();
    outcomesRef.current = list; setOutcomes(list); setMode(practice ? 'learn' : 'result');
    setEngineProblem(false); setError('');
    if (practice) { setIndex(0); setVersion(v => v+1); }
    const passed = list.length === context.chars.length && list.every(o => o.result.passed);
    setGrade(!passed ? 'Again' : list.some(o => o.result.suggestedGrade === 'Hard') ? 'Hard' : 'Good');
  };
  const finish = (failure?: RecallFailure, practice = false) => {
    if (!active.current || !loaded || !attemptRef.current) return;
    const current = failure ? failRecall(attemptRef.current, failure) : attemptRef.current;
    update(current);
    const level = loaded.progress[index].level;
    const result = gradeAttempt(current, level, settings.thresholds[level]);
    const next = [...outcomesRef.current, { character: context.chars[index], attempt: current, result }];
    if (failure || index === context.chars.length-1) summarize(next, practice);
    else {
      outcomesRef.current = next; setOutcomes(next);
      setInputNotice(''); setDiagnostics([]);
      setIndex(index+1); update(newAttempt(loaded.data[index+1].strokes.length)); setVersion(v => v+1);
    }
  };
  useEffect(() => { if (revealed && active.current) finish('answer-revealed'); }, [revealed]);
  const start = async () => {
    if (!loaded || suspended || startGuard.current) return;
    startGuard.current = true; setChecking(true);
    const token = ++controlVersion.current;
    try {
      const eligible = !revealedRef.current && await checkCurrent.current(false);
      if (!live.current || token !== controlVersion.current) return;
      if (!eligible || revealedRef.current) {
        setError('Testing is unavailable after answer reveal, during lookback, or after changing cards. Use guided practice.'); return;
      }
      setIndex(0); outcomesRef.current = []; setOutcomes([]); setDiagnostics([]); setInputNotice('');
      setEngineProblem(false); setSaveState('idle'); id.current = createId();
      update(newAttempt(loaded.data[0].strokes.length)); active.current = true;
      setMode('test'); setError(''); setVersion(v => v+1);
    } catch { if (live.current && token === controlVersion.current) setError('The current review could not be verified. Testing is blocked.'); }
    finally { startGuard.current = false; if (live.current) setChecking(false); }
  };
  const stroke = (data: StrokeData, type: 'accepted' | 'rejected') => {
    if (!active.current || suspended || engineProblem || !attemptRef.current || data.character !== context.chars[index]) return;
    if (revealedRef.current) { finish('answer-revealed'); return; }
    const next = addStroke(attemptRef.current, data.strokeNum, type);
    if (next === attemptRef.current) return;
    setInputNotice('');
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
        // Once verified, finish this explicit-ID batch even if navigation unmounts the widget.
        // It only saves plugin mastery; it never submits a native review rating.
        await repository.save(context.vocabularyId, o.character, { id: id.current + ':' + o.character,
          at: completedAt.current, cardId: context.cardId, character: o.character, result: o.result, attempt: o.attempt, source: 'test' }, settings);
      }
      if (onSaveResult) {
        const completed = outcomesRef.current;
        await onSaveResult({ id: id.current, at: completedAt.current,
          passed: completed.length === context.chars.length && completed.every(o => o.result.passed),
          accuracy: Math.min(...completed.map(o => o.result.accuracy)), total: context.chars.length,
          failure: completed.find(o => o.result.failure)?.result.failure });
      }
      if (live.current) setSaveState('saved');
    } catch (e) { if (live.current) { setSaveState('failed'); setError(e instanceof Error ? e.message : 'Mastery could not be saved. Retry before leaving this card.'); } }
    finally { saving.current = false; }
  };
  useEffect(() => { if ((mode === 'result' || mode === 'learn') && outcomes.length && saveState === 'idle') void save(); }, [mode]);
  const guided = () => {
    controlVersion.current++;
    if (active.current) { finish('guided-practice', true); return; }
    setMode('learn'); setIndex(0); setEngineProblem(false); setVersion(v => v+1);
  };
  const retryEngine = async () => {
    if (suspended || startGuard.current) return;
    startGuard.current = true; setChecking(true);
    const token = ++controlVersion.current;
    try {
      const eligible = mode !== 'test' || (!revealedRef.current && await checkCurrent.current(false));
      if (!live.current || token !== controlVersion.current) return;
      if (!eligible || (mode === 'test' && revealedRef.current)) {
        setError('This test cannot resume on a revealed or different card. End the test or use guided practice.');
        return;
      }
      if (live.current) { setEngineProblem(false); setError(''); setVersion(v => v+1); }
    } catch { if (live.current && token === controlVersion.current) setError('The current review could not be verified. Your stroke record is preserved.'); }
    finally { startGuard.current = false; if (live.current) setChecking(false); }
  };
  const resultVisible = outcomes.length > 0 && (mode === 'result' || mode === 'learn');
  const passed = outcomes.length === context.chars.length && outcomes.every(o => o.result.passed);
  const currentLevel = loaded?.progress[index].level || 0;
  const currentScore = attempt && gradeAttempt(attempt, currentLevel, settings.thresholds[currentLevel]);
  const last = attempt?.events.at(-1);
  useEffect(() => {
    if (!last || last.type !== 'rejected' || last.accidental) return;
    const timer = window.setTimeout(() => tickAccidentDeadline(v => v+1), Math.max(0, 8001 - (Date.now()-last.at)));
    return () => window.clearTimeout(timer);
  }, [last?.id, last?.accidental]);
  const accidentAvailable = mode === 'test' && last?.type === 'rejected' && !last.accidental && !attempt?.completed &&
    Date.now()-last.at <= 8000 &&
    (attempt?.events.filter(e => e.accidental).length || 0) < settings.accidentLimit;
  const savedText = saveState === 'saved' ? 'Writing mastery saved and read back.' :
    saveState === 'saving' ? 'Saving writing mastery…' : 'Writing mastery has not been saved.';
  const summaryScore = outcomes.length ? Math.min(...outcomes.map(outcome => outcome.result.accuracy)) : 0;
  return <section className={`hm hm-review hm-writing hm-mode-${mode}${fitToCard ? ' hm-review-fit' : ''}`} aria-label={regionLabel}>
    <header className="hm-review-heading">
      <div className="hm-review-heading-text"><h2 className="hm-review-prompt" title={context.prompt}>{context.prompt}</h2>
        <div className="hm-review-meta"><span>{skillLabel}</span><span>{mode === 'learn' ? 'Guided practice' : LEVEL_NAMES[currentLevel]}</span>
          <span>{Math.round(settings.thresholds[currentLevel]*100)}% to pass</span>
          {context.chars.length > 1 && <span>Character {index+1} / {context.chars.length}</span>}</div>
        {mode === 'learn' && outcomes.length > 0 && <div className="hm-preserved-result" role="status">
          <strong>{passed ? 'Passed this writing test' : 'Writing test failed'}</strong>
          <em>{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Not saved'}</em>
          <span className="hm-a11y">Original writing test: {passed ? 'Passed' : 'Failed'}. Practice does not change this result.</span>
          <small className="hm-a11y">{savedText}</small>
        </div>}
      </div>
      <button className="hm-icon-button" aria-label="Review options and details" title="Review options and details" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setSheet(true); }}>···</button>
    </header>
    <div className="hm-review-workspace">
      {(error || suspended) && <div className="hm-review-notice" role={error ? 'alert' : 'status'}>
        {error || 'Waiting for RemNote to confirm the current card. Writing is paused; your stroke record is preserved.'}
        {!loaded && error && <button onClick={() => setReload(v => v+1)}>Retry loading</button>}
      </div>}
      {!loaded && !error && <p role="status">Loading stroke data and mastery…</p>}
      {loaded && mode === 'ready' && <ReviewStart fit={fitToCard}><span>Write from memory</span>
          <small>{revealed ? 'Answer revealed — use guided practice' : 'Recall every stroke independently'}</small>
      </ReviewStart>}
      {mode === 'test' && attempt && currentScore && <div className="hm-score" aria-live="polite">
        <strong>First-attempt accuracy: {Math.round(currentScore.accuracy*100)}%</strong>
        <span>{attempt.events.filter(e => e.type === 'accepted').length} / {attempt.totalStrokes} strokes · {currentScore.mistakes} rejected attempts</span>
      </div>}
      {loaded && (mode === 'test' || mode === 'learn') && <div className="hm-writing-stage">
        {engineProblem && <button disabled={suspended || checking} onClick={() => void retryEngine()}>Retry writing canvas</button>}
        {!engineProblem && <WriterCanvas fit={fitToCard} hideControls controlsRef={practiceControls} onReadyChange={setCanvasReady}
          character={context.chars[index]} data={loaded.data[index]} mode={mode} active={!suspended && !sheet} settings={settings} generation={version}
          resumeStrokeNum={mode === 'test' ? attempt?.events.filter(e => e.type === 'accepted').length : 0}
          onCorrect={d => stroke(d, 'accepted')} onMistake={d => stroke(d, 'rejected')}
          onComplete={() => { if (attemptRef.current?.completed) finish(); }}
          onInputCancelled={() => setInputNotice('The device interrupted this contact. Retry the current stroke; completed strokes and recorded errors are preserved.')}
          onError={() => { setEngineProblem(true); setError('The handwriting engine stopped. Retry the canvas to continue; completed strokes and recorded errors are preserved.'); }} />}
      </div>}
      {mode === 'test' && inputNotice && <p className="hm-contact-notice" role="status">{inputNotice}</p>}
      {mode === 'result' && <ReviewResult title={passed ? 'Passed this writing test' : 'Writing test failed'} headingRef={resultHeading}
        passed={passed} target={context.chars.join('')} score={`${Math.round(summaryScore*100)}%`} grade={grade}
        saveState={saveState} savedText={savedText} onRetry={() => void save()} />}
    </div>
    <footer className="hm-review-controls">
      {loaded && mode === 'ready' && <><button className="hm-primary" disabled={revealed || suspended || checking} onClick={() => void start()}>{checking ? 'Checking current card…' : 'Begin test'}</button>
        <button onClick={guided}>Guided practice only</button></>}
      {mode === 'test' && <><button className="hm-danger" aria-label="I forgot a stroke — end test" onClick={() => finish('forgotten-stroke')}>Forgot a stroke</button>
        <button aria-label="Last input was accidental" disabled={!accidentAvailable || suspended} onClick={() => update(markLastAccidental(attemptRef.current!, settings.accidentLimit))}>Accidental input</button></>}
      {mode === 'learn' && <>
        <button aria-label="Animate strokes" disabled={!canvasReady || suspended} onClick={() => practiceControls.current?.animate()}>▶ <span>Animate</span></button>
        <button aria-label="Practice again" disabled={!canvasReady} onClick={() => practiceControls.current?.restart()}>↻ <span>Again</span></button>
        <button aria-label="Show character" disabled={!canvasReady || suspended} onClick={() => practiceControls.current?.show()}>◉ <span>Show</span></button>
        {context.chars.length > 1 && <button aria-label="Next practice character" onClick={() => { setIndex(i => (i+1)%context.chars.length); setVersion(v => v+1); }}>→</button>}
      </>}
      {mode === 'result' && <button className="hm-primary" onClick={guided}>Practice with hints and animation</button>}
    </footer>
    {sheet && <ReviewSheet title="Review details" onClose={closeSheet}>
      <h3>{context.prompt}</h3>
      <p>{settings.script === 'traditional' ? 'Traditional' : 'Simplified'} · {LEVEL_NAMES[currentLevel]} · {Math.round(settings.thresholds[currentLevel]*100)}% required</p>
      {resultVisible && <>
        <h3>Character results ({outcomes.length})</h3>
        {outcomes.map((o, i) => <p key={i}>{o.character}: {o.result.firstAttempts}/{o.result.totalStrokes} first attempts · {Math.round(o.result.accuracy*100)}% / {Math.round(o.result.threshold*100)}% required
          {o.result.accidents > 0 && ` · raw ${Math.round(o.result.rawAccuracy*100)}%, ${o.result.accidents} declared accident(s)`}
          {o.result.failure && ` · ${o.result.failure.replaceAll('-', ' ')}`}</p>)}
        <label>Your rating choice <select value={grade} onChange={e => setGrade(e.target.value as Grade)}>{(['Again','Hard','Good','Easy'] as Grade[]).map(g => <option key={g} value={g}>{g}</option>)}</select></label>
        <p>Your choice is advisory. Use RemNote's native controls to submit a rating.</p>
      </>}
      {mode === 'test' && <button onClick={() => { closeSheet(); guided(); }}>End test for guided practice</button>}
      <h3>Recall and scoring</h3>
      <p>Recall every stroke independently. Corrections lower first-attempt accuracy. A forgotten stroke, assistance or answer reveal fails the test.</p>
      <p>Accident correction applies only to the latest rejected input within 8 seconds, before drawing again. Limit {settings.accidentLimit} per character. Original errors stay in the record.</p>
      <h3>Stroke standards</h3>
      <p>Hanzi Writer sequences can differ from Taiwan MOE. First-attempt accuracy measures recognizer acceptance, not penmanship precision.</p>
      <p>Mastery requires separate review days at least {settings.minSpacingHours} hours apart. Guided practice preserves the original result. RemNote controls scheduling.</p>
      {settings.geometryFeedback && diagnostics.filter(Boolean).length > 0 && <p>Experimental path diagnostic: mean reference-path deviation {(diagnostics.reduce((sum,d) => sum+(d?.trajectoryError || 0),0)/diagnostics.length*100).toFixed(1)}%. Feedback only; not a penmanship grade.</p>}
    </ReviewSheet>}
  </section>;
}
