import React, { useEffect, useRef, useState } from 'react';
import { checkRecall, isTranslationSkill, parsePinyin, RECALL_NAMES, shuffleChoices, type RecallResult, type RecallSchema } from '../core/recall';
import { SkillRepository, type SkillHistory, type SkillRecord } from '../services/recall';
import { ReferenceAudio } from './ReferenceAudio';
import { PronunciationRecorder } from './PronunciationRecorder';
import { createId } from '../core/ids';
import type { Settings } from '../core/config';
import { MeaningWritingExercise } from './MeaningWritingExercise';
import { PinyinInput } from './PinyinInput';
import { TonePicker } from './TonePicker';
import { ReviewResult } from './ReviewResult';
import { buildCharacterChoices } from '../core/characterChoices';

export interface RecallExerciseProps {
  context: { cardId: string; schema: RecallSchema }; repository: SkillRepository;
  revealed: boolean; suspended?: boolean; isCurrent(allowRevealed?: boolean): Promise<boolean>;
  settings?: Settings; assetRoot?: string; fitToCard?: boolean;
}
export function RecallExercise(props: RecallExerciseProps) {
  return props.context.schema.skill === 'english-to-chinese' ? <MeaningWritingExercise {...props} /> : <RecallFormExercise {...props} />;
}
function RecallFormExercise({ context, repository, revealed, suspended, isCurrent, fitToCard }: RecallExerciseProps) {
  const { schema } = context, syllables = schema.pinyin.trim() ? parsePinyin(schema.pinyin) : [];
  const translation = isTranslationSkill(schema.skill), selfAssessed = translation || schema.skill === 'pronunciation';
  const [mode, setMode] = useState<'ready'|'test'|'assess'|'result'|'practice'>('ready');
  const [answer, setAnswer] = useState(''), [tones, setTones] = useState<number[]>(syllables.map(() => 0));
  const [choiceState] = useState(() => {
    try { return { choices: schema.skill === 'character-choice' ? shuffleChoices(buildCharacterChoices(schema, schema.choices || [])) : [], error: '' }; }
    catch { return { choices: [], error: 'Four unambiguous choices are needed. Update this character-recognition card in the workbench.' }; }
  });
  const choices = choiceState.choices;
  const [heard, setHeard] = useState(false), [recorded, setRecorded] = useState(false);
  const [spokenAttempt, setSpokenAttempt] = useState(false);
  const [result, setResult] = useState<RecallResult>(), [history, setHistory] = useState<SkillHistory>();
  const [saveState, setSaveState] = useState<'idle'|'saving'|'saved'|'failed'>('idle');
  const [checking, setChecking] = useState(false), [error, setError] = useState('');
  const live = useRef(true), active = useRef(false), done = useRef(false), saving = useRef(false);
  const guard = useRef(false), operation = useRef(0), record = useRef<SkillRecord>();
  const awaitingAssessment = useRef(false), submittedAnswer = useRef('');
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
    record.current = { id: createId(), at: Date.now(), cardId: context.cardId, result: value };
    setResult(value); setMode('result'); setChecking(false);
  };
  const fail = (failure: 'answer-revealed'|'forgotten') => finish({ passed: false, accuracy: 0,
    spellingCorrect: 0, tonesCorrect: 0, total: translation ? 1 : syllables.length,
    assessment: selfAssessed ? 'self' : 'checked', failure });
  useEffect(() => { if (revealed && active.current && !awaitingAssessment.current) fail('answer-revealed'); }, [revealed]);
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
        (translation && (awaitingAssessment.current ? selfPassed === undefined : !answer.trim())) ||
        (schema.skill === 'character-choice' && !choices.some(c => c.traditional === answer)) ||
        (schema.skill === 'listening' && !heard) ||
        (schema.skill === 'pronunciation' && (!spokenAttempt || (selfPassed && !heard)))) return;
    guard.current = true; setChecking(true); setError(''); const token = operation.current;
    try {
      const current = await host.current.isCurrent(awaitingAssessment.current);
      if (!live.current || token !== operation.current || !active.current) return;
      if (host.current.revealed && !awaitingAssessment.current) { fail('answer-revealed'); return; }
      if (!current || host.current.suspended) { setError('This is no longer the confirmed current review. Your answer is preserved.'); return; }
      if (translation && !awaitingAssessment.current) {
        submittedAnswer.current = answer.trim().slice(0, 200); awaitingAssessment.current = true; operation.current++;
        setMode('assess'); return;
      }
      finish(translation ? { passed: !!selfPassed, accuracy: selfPassed ? 1 : 0, spellingCorrect: 0, tonesCorrect: 0,
        total: 1, assessment: 'self', answer: submittedAnswer.current } : schema.skill === 'pronunciation' ? { passed: !!selfPassed, accuracy: selfPassed ? 1 : 0,
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
  const disabled = !!suspended || checking || (revealed && !awaitingAssessment.current);
  const referenceVisible = schema.skill === 'listening' || schema.skill === 'pronunciation' || mode === 'practice';
  return <section className={`hm hm-review hm-recall hm-mode-${mode}${fitToCard ? ' hm-recall-fit' : ''}`} aria-label="Hanzi Mastery study review">
    <header className="hm-recall-heading"><h1>Hanzi Mastery</h1><span className="hm-badge">{RECALL_NAMES[schema.skill]}</span></header>
    <main className="hm-recall-body">
    {!result && (mode === 'ready' || mode === 'test') && (schema.skill !== 'listening' || mode === 'ready') && <div className="hm-recall-prompt">
      {schema.skill !== 'listening' && schema.skill !== 'character-choice' && <h2 className="hm-target" lang="zh-Hant">{schema.traditional}</h2>}
      {schema.skill === 'character-choice' && <h2 className="hm-target hm-pinyin-target" lang="zh-Latn-pinyin">{schema.pinyin}</h2>}
      {schema.skill === 'tones' && mode === 'ready' && <p className="hm-tone-prompt" lang="zh-Latn-pinyin">{syllables.map(s => s.base).join(' ')}</p>}
      {schema.skill === 'listening' && <div className="hm-listening-symbol" aria-hidden="true">♪</div>}
    </div>}
    {(error || choiceState.error) && <p role="alert" className="hm-error">{error || choiceState.error}</p>}
    {suspended && <p role="status">Waiting for RemNote. Your answer is preserved.</p>}
    {!history && !error && <p role="status">Loading skill results…</p>}
    {mode === 'ready' && <>
      <p>{translation ? 'Recall the meaning, then compare. Equivalent wording is welcome.' : schema.skill === 'pinyin' ? 'Recall the pinyin and tones.' :
        schema.skill === 'tones' ? 'Choose the tone for each syllable.' :
        schema.skill === 'character-choice' ? 'Which characters match this pinyin?' :
        schema.skill === 'listening' ? 'Listen to the reference, then enter its pinyin.' :
        'Say the word, then listen and compare. Record your attempt if you like.'}</p>
      <div className="hm-actions"><button className="hm-primary" disabled={disabled || !history || !!choiceState.error} onClick={() => void start()}>Begin {schema.skill === 'pronunciation' ? 'spoken practice' : 'recall test'}</button>
        <button onClick={() => { if (!guard.current) { operation.current++; setMode('practice'); } }}>Study with answer</button></div>
      {revealed && <p className="hm-muted">The answer is already visible. Study is available; testing is disabled.</p>}
    </>}
    {mode === 'test' && schema.skill === 'pronunciation' && !spokenAttempt && <>
      <p>Say this word aloud before listening to the reference.</p>
      <button className="hm-primary" disabled={disabled} onClick={() => setSpokenAttempt(true)}>I’ve said it — compare with reference</button>
    </>}
    {mode !== 'ready' && schema.skill === 'pronunciation' && <div className="hm-spoken-recording">
      <PronunciationRecorder disabled={!!suspended || checking || (mode === 'test' && (revealed || (spokenAttempt && !recorded))) || mode === 'result'}
        onReady={() => { setRecorded(true); setSpokenAttempt(true); }} />
    </div>}
    {referenceVisible && mode !== 'ready' && <ReferenceAudio text={schema.traditional} url={schema.referenceAudio}
      disabled={!!suspended || checking || (mode === 'test' && (revealed || (schema.skill === 'pronunciation' && !spokenAttempt)))} onPlayed={() => setHeard(true)} />}
    {mode === 'test' && schema.skill !== 'pronunciation' && <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); void submit(); }}>
      {translation ? <label>Your meaning<input
        aria-label="Your meaning" value={answer} disabled={disabled} placeholder="What does it mean?"
        autoComplete="off" spellCheck={false} onChange={e => setAnswer(e.target.value)} /></label> : schema.skill === 'character-choice' ? <fieldset className="hm-form" disabled={disabled}>
        <legend className="hm-a11y">Which characters match {schema.pinyin}?</legend>
        <div className="hm-character-choices">{choices.map(choice => <label key={choice.traditional} className={`hm-character-choice ${answer === choice.traditional ? 'hm-selected' : ''}`}>
          <input type="radio" name="character-choice" value={choice.traditional} checked={answer === choice.traditional}
            onChange={() => setAnswer(choice.traditional)} /><span lang="zh-Hant">{choice.traditional}</span>
        </label>)}</div>
      </fieldset> : schema.skill === 'tones' ? <fieldset className="hm-form hm-tones" disabled={disabled}>
        {syllables.map((s, i) => <TonePicker key={i} syllable={s.base} index={i} value={tones[i]} disabled={disabled}
          onChange={value => setTones(old => old.map((t, j) => i === j ? value : t))} />)}
      </fieldset> : <PinyinInput value={answer} disabled={disabled} onChange={setAnswer} />}
      {schema.skill === 'listening' && !heard && <p className="hm-muted">Play the reference to the end before checking your answer.</p>}
      <button className="hm-primary hm-check-answer" type="submit" disabled={disabled || !!choiceState.error || (schema.skill === 'tones' ? tones.some(t => !t) : !answer.trim()) || (schema.skill === 'listening' && !heard)}>{translation ? 'Compare first answer' : 'Check first answer'}</button>
    </form>}
    {mode === 'test' && schema.skill === 'pronunciation' && spokenAttempt && <>
      <p className="hm-result-reading">{schema.pinyin}</p><p>{recorded ? 'Compare your recording' : 'Compare what you said'} with the reference.</p>
      <div className="hm-actions"><button disabled={disabled || !heard} onClick={() => void submit(true)}>I pronounced it correctly</button>
        <button disabled={disabled} onClick={() => void submit(false)}>Needs practice</button></div>
      {!heard && <p className="hm-muted">Listen to the reference before marking your pronunciation correct.</p>}
    </>}
    {mode === 'assess' && <ReviewResult title="Compare your meaning" target={schema.traditional} reading={schema.pinyin} meaning={schema.meaning}>
      <div className="hm-answer-comparison"><small>Your first answer</small><p>{submittedAnswer.current}</p></div>
      <p>Does your answer express this meaning? Equivalent wording is welcome.</p>
      <div className="hm-actions"><button className="hm-primary" disabled={disabled} onClick={() => void submit(true)}>My answer is correct</button>
        <button disabled={disabled} onClick={() => void submit(false)}>Needs practice</button></div>
    </ReviewResult>}
    {(result || mode === 'practice') && <ReviewResult title={result ? (result.assessment === 'self' ? `${RECALL_NAMES[schema.skill]}: self-assessed` : result.passed ? 'Correct on the first answer' : 'Recall test needs practice') : 'Study the reference'}
      passed={result?.passed} target={schema.traditional} reading={schema.pinyin} meaning={schema.meaning}
      score={result?.assessment === 'checked' ? `${Math.round(result.accuracy * 100)}%` : undefined}
      saveState={result ? saveState : undefined} savedText={result && saveState === 'saved' ? 'Skill result saved and read back.' : undefined}
      grade={result ? result.passed ? 'Good / Recalled' : 'Again / Forgot' : undefined} onRetry={() => void save()}>
      {result?.failure && <p>{result.failure === 'answer-revealed' ? 'The native answer was revealed before completion.' : 'Independent recall was not completed.'}</p>}
      <details className="hm-outcome-details"><summary>Answer details</summary>
      {result && <>
        {translation && result.answer && <p>Your first answer: {result.answer}</p>}
        {result.assessment === 'checked' && schema.skill !== 'character-choice' && <p>{schema.skill !== 'tones' && `${result.spellingCorrect}/${result.total} syllables spelled correctly · `}{result.tonesCorrect}/{result.total} tones correct</p>}
        {schema.skill === 'character-choice' && result.answer && <p>Your choice: <span lang="zh-Hant">{result.answer}</span>{result.passed ? ' — correct' : ' — incorrect'}</p>}
      </>}
      {schema.skill === 'character-choice' && <ul className="hm-choice-readings" aria-label="Choice readings">{choices.map(choice =>
        <li key={choice.traditional}><span lang="zh-Hant">{choice.traditional}</span> — {choice.pinyin}</li>)}</ul>}
      {!!syllables.length && <p>Dictionary tones: {syllables.map(s => s.tone).join(' · ')}. Connected speech may change how tones sound.</p>}
      </details>
      {!result && <p>Study only. This does not save a test result.</p>}
      {result && mode !== 'practice' && <button onClick={() => setMode('practice')}>Study with the reference</button>}
    </ReviewResult>}
    </main>
    <footer className="hm-recall-footer">
      {mode === 'test' && <button className="hm-skip-test" disabled={disabled} onClick={() => fail('forgotten')}>I don’t know — end test</button>}
      {history && <small className="hm-muted">{history.passed}/{history.attempts} successful{schema.skill === 'pronunciation' ? ' · self-assessed' : ''}</small>}
    </footer>
  </section>;
}
