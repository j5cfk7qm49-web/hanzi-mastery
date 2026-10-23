import React from 'react';
const names = ['level', 'rising', 'dipping', 'falling', 'neutral'];
const paths = ['M6 16H54', 'M6 28L54 4', 'M6 4L30 28L54 4', 'M6 4L54 28'];
export function TonePicker({ syllable, index, value, disabled, onChange }: {
  syllable: string; index: number; value: number; disabled?: boolean; onChange(value: number): void;
}) {
  return <div className="hm-tone-item"><p>{syllable} <small>syllable {index + 1}</small></p>
    <div className="hm-tone-picker" role="radiogroup" aria-label={`Tone for syllable ${index + 1}`}>
      {names.map((name, i) => <button type="button" role="radio" aria-checked={value === i + 1} key={i}
        className={`hm-tone-position-${i + 1}`} disabled={disabled} aria-label={`${i + 1} — ${name}`}
        onClick={() => onChange(i + 1)} onKeyDown={e => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
          e.preventDefault(); const next = (i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 4 : 1)) % 5;
          onChange(next + 1); (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
        }}><span aria-hidden="true"><svg viewBox="0 0 60 32" focusable="false">
          {i === 4 ? <circle cx="30" cy="16" r="3" fill="currentColor" /> : <path d={paths[i]} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
        </svg></span><small aria-hidden="true">{i + 1}</small></button>)}
    </div>
  </div>;
}
