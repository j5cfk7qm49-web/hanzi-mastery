import React, { useRef } from 'react';
import { applyPinyinTone, applyPinyinUmlaut, formatPinyinInput } from '../core/pinyinInput';

export function PinyinInput({ value, disabled, onChange }: { value: string; disabled?: boolean; onChange(value: string): void }) {
  const input = useRef<HTMLInputElement>(null), composing = useRef(false);
  const restore = (caret: number) => requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(caret, caret); });
  return <div className="hm-pinyin-entry">
    <label>Your pinyin<input ref={input} aria-label="Your pinyin" value={value} disabled={disabled} autoComplete="off" autoCapitalize="none" spellCheck={false}
      placeholder="Type pinyin" onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={e => { composing.current = false; onChange(formatPinyinInput(e.currentTarget.value)); }}
      onChange={e => { const raw = e.currentTarget.value, caret = e.currentTarget.selectionStart ?? raw.length;
        onChange(composing.current ? raw : formatPinyinInput(raw));
        if (!composing.current && raw !== formatPinyinInput(raw)) restore(formatPinyinInput(raw.slice(0, caret)).length);
      }} /></label>
    <div className="hm-pinyin-tools" role="group" aria-label="Pinyin tone marks">
      {['ˉ', 'ˊ', 'ˇ', 'ˋ'].map((mark, i) => <button key={i} type="button" aria-label={`Add tone ${i + 1}`}
        disabled={disabled || !value.trim()} onMouseDown={e => e.preventDefault()} onClick={() => {
          const next = applyPinyinTone(value, input.current?.selectionStart ?? value.length, i + 1); onChange(next.value); restore(next.caret);
        }}><span aria-hidden="true">{mark}</span></button>)}
      <button type="button" aria-label="Add umlaut" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => {
        const from = input.current?.selectionStart ?? value.length, to = input.current?.selectionEnd ?? from;
        const next = applyPinyinUmlaut(value, from, to); onChange(next.value); restore(next.caret);
      }}><span aria-hidden="true">¨</span></button>
    </div>
    <details className="hm-input-help"><summary>Typing help</summary><p>Separate syllables with spaces. Tone buttons change the syllable at the cursor. The umlaut button changes u to ü, or inserts ü. Numbered tones turn into marks as you type: shi2 → shí. v and u: become ü. An unmarked syllable is neutral; type tone 5 to remove a tone mark.</p></details>
  </div>;
}
