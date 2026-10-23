import React from 'react';
import { expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { applyPinyinTone, applyPinyinUmlaut, formatPinyinInput } from '../src/core/pinyinInput';
import { PinyinInput } from '../src/ui/PinyinInput';

it('formats typed numbered tones and umlauts without supplying an expected reading', () => {
  expect(formatPinyinInput('shi2 nv3 lu:4 ni3 hao3 de5')).toBe('shí nǚ lǜ nǐ hǎo de');
  expect(formatPinyinInput('nǐ4')).toBe('nì');
  expect(formatPinyinInput('sh')).toBe('sh');
  expect(formatPinyinInput('lu:')).toBe('lü');
});
it('applies and replaces a tone only in the syllable at the cursor', () => {
  expect(applyPinyinTone('ni hao', 1, 3)).toEqual({ value: 'nǐ hao', caret: 2 });
  expect(applyPinyinTone('nǐ hǎo', 6, 4)).toEqual({ value: 'nǐ hào', caret: 6 });
  expect(applyPinyinTone('nǚ', 2, 5)).toEqual({ value: 'nü', caret: 2 });
  expect(applyPinyinTone('', 0, 2)).toEqual({ value: '', caret: 0 });
});
it('offers four standalone tone marks and an umlaut while preserving the entered text', () => {
  function Entry() { const [value, setValue] = React.useState('lu'); return <PinyinInput value={value} onChange={setValue} />; }
  render(<Entry />); const input = screen.getByLabelText('Your pinyin') as HTMLInputElement;
  input.setSelectionRange(2, 2); fireEvent.click(screen.getByRole('button', { name: 'Add tone 4' }));
  expect(input.value).toBe('lù');
  fireEvent.change(input, { target: { value: 'nv3' } }); expect(input.value).toBe('nǚ');
  expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['ˉ', 'ˊ', 'ˇ', 'ˋ', '¨']);
  fireEvent.change(input, { target: { value: 'lu' } }); input.setSelectionRange(2, 2);
  fireEvent.click(screen.getByRole('button', { name: 'Add umlaut' })); expect(input.value).toBe('lü');
});
it('adds an umlaut within the current syllable and retains an existing tone', () => {
  expect(applyPinyinUmlaut('lù', 2)).toEqual({ value: 'lǜ', caret: 2 });
  expect(applyPinyinUmlaut('lu ni', 5)).toEqual({ value: 'lu niü', caret: 6 });
  expect(applyPinyinUmlaut('lu', 1)).toEqual({ value: 'lü', caret: 2 });
  expect(applyPinyinUmlaut('lü', 2)).toEqual({ value: 'lü', caret: 2 });
});
