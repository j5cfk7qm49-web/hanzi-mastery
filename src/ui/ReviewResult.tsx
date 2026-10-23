import React from 'react';

/** The same outcome hierarchy for writing, recall and audio exercises. */
export function ReviewResult({ title, passed, target, reading, meaning, score, grade, saveState, savedText, onRetry, children, headingRef }: {
  title: string; passed?: boolean; target: string; reading?: string; meaning?: string; score?: string; grade?: string;
  saveState?: 'idle'|'saving'|'saved'|'failed'; savedText?: string; onRetry?(): void; children?: React.ReactNode;
  headingRef?: React.RefObject<HTMLHeadingElement>;
}) {
  return <div className={`hm-result hm-outcome ${passed === undefined ? '' : passed ? 'hm-pass' : 'hm-fail'}`} role="status">
    {passed !== undefined && <span className="hm-outcome-symbol" aria-hidden="true">{passed ? '✓' : '↻'}</span>}
    <h2 ref={headingRef}>{title}</h2>
    <div className="hm-result-metrics"><span className="hm-result-target" lang="zh-Hant">{target}</span>
      {score && <strong className="hm-result-score">{score}</strong>}</div>
    {reading && <p className="hm-result-reading" lang="zh-Latn-pinyin">{reading}</p>}
    {meaning && <p className="hm-result-meaning">{meaning}</p>}
    {grade && <p className="hm-grade">Suggested RemNote rating: <b>{grade}</b></p>}
    {saveState && <p className="hm-save-status" aria-label={saveState === 'saved' ? 'Result saved' : undefined}>
      {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Could not save' : 'Not saved'}
    </p>}
    {saveState === 'failed' && <button onClick={onRetry}>Retry result save</button>}
    {savedText && <span className="hm-a11y">{savedText}</span>}
    {children}
  </div>;
}
