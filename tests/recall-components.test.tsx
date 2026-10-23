import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { RecallExercise, type RecallExerciseProps } from '../src/ui/RecallExercise';
import { SkillRepository, skillHistoryKey } from '../src/services/recall';
import type { RecallSchema } from '../src/core/recall';
import type { SyncedStore } from '../src/services/persistence';
const audio = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('../src/services/audio', () => ({ localMandarinVoices: () => [], playReference: audio.play }));
beforeEach(() => audio.play.mockReset().mockReturnValue(() => {}));
const schema: RecallSchema = { version: 1, skill: 'pinyin', vocabularyId: 'v', traditional: '仁', pinyin: 'rén', meaning: 'benevolence' };
function setup(change: Partial<RecallExerciseProps> = {}, skill = schema.skill) {
  const values = new Map<string, unknown>();
  const store: SyncedStore = { getSynced: async <T,>(key: string) => values.get(key) as T | undefined,
    setSynced: vi.fn(async (key: string, value: unknown) => { values.set(key, value); }) };
  const props: RecallExerciseProps = { context: { cardId: 'c', schema: { ...schema, skill } },
    repository: new SkillRepository(store), revealed: false, isCurrent: async () => true, ...change };
  return { props, store, values, view: render(<RecallExercise {...props} />) };
}
async function begin(spoken = false) {
  const button = await screen.findByRole('button', { name: spoken ? 'Begin spoken practice' : 'Begin recall test' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
  await screen.findByRole('button', { name: 'I don’t know — end test' });
}
it('checks pinyin and tones on the first submission without exposing the expected reading', async () => {
  const { view, store } = setup(); await begin();
  expect(view.container.innerHTML).not.toContain('rén');
  fireEvent.change(screen.getByLabelText('Your pinyin'), { target: { value: 'ren2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check first answer' }));
  await screen.findByText('Skill result saved and read back.');
  expect(screen.getByText('Correct on the first answer')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Study with the reference' }));
  expect(store.setSynced).toHaveBeenCalledTimes(1);
});
it('fails a missing tone and freezes the original result when entering study mode', async () => {
  const { values, props } = setup(); await begin();
  fireEvent.change(screen.getByLabelText('Your pinyin'), { target: { value: 'ren' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check first answer' }));
  await screen.findByText('Skill result saved and read back.');
  fireEvent.click(screen.getByRole('button', { name: 'Study with the reference' }));
  expect(screen.getByText('Recall test needs practice')).toBeTruthy();
  expect(values.get(skillHistoryKey(props.context.schema))).toMatchObject({ attempts: 1, passed: 0 });
});
it('tests tone knowledge through explicit syllable choices with no tracing', async () => {
  const { view } = setup({}, 'tones'); await begin();
  expect(screen.getByText('ren', { exact: true })).toBeTruthy();
  expect(view.container.innerHTML).not.toContain('rén');
  fireEvent.click(screen.getByRole('radio', { name: '2 — rising' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check first answer' }));
  await screen.findByText('Correct on the first answer');
  expect(screen.queryByRole('application')).toBeNull();
});

const choiceSchema: RecallSchema = { ...schema, skill: 'character-choice', choices: [
  { traditional: '仁', pinyin: 'rén' }, { traditional: '書', pinyin: 'shū' }, { traditional: '愛', pinyin: 'ài' },
] };
it('shows pinyin without identifying the correct character, then saves and freezes a wrong choice', async () => {
  const { view, values } = setup({ context: { cardId: 'choice', schema: choiceSchema } });
  expect(screen.queryByRole('heading', { name: '仁', exact: true })).toBeNull();
  await begin();
  expect(screen.getAllByRole('radio')).toHaveLength(4);
  expect(view.container.innerHTML).not.toContain('benevolence');
  expect(view.container.innerHTML).not.toContain('shū');
  fireEvent.submit(screen.getByRole('button', { name: 'Check first answer' }).closest('form')!);
  expect(values.size).toBe(0);
  fireEvent.click(screen.getByRole('radio', { name: '書', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Check first answer' }));
  await screen.findByText('Skill result saved and read back.');
  expect(screen.getByText((_text, element) => element?.tagName === 'P' && element.textContent === 'Your choice: 書 — incorrect')).toBeTruthy();
  expect(values.get(skillHistoryKey(choiceSchema))).toMatchObject({ attempts: 1, passed: 0, history: [{ result: { answer: '書' } }] });
  fireEvent.click(screen.getByRole('button', { name: 'Study with the reference' }));
  expect(screen.getByText('Recall test needs practice')).toBeTruthy();
  fireEvent.click(screen.getByText('Answer details'));
  expect(screen.getByRole('list', { name: 'Choice readings' }).textContent).toContain('書 — shū');
});
it('preserves shuffled choices and selection across interruption and checks the correct character', async () => {
  const { props, view } = setup({ context: { cardId: 'choice', schema: choiceSchema } }); await begin();
  const order = screen.getAllByRole('radio').map(r => (r as HTMLInputElement).value);
  fireEvent.click(screen.getByRole('radio', { name: '仁', exact: true }));
  view.rerender(<RecallExercise {...props} suspended />);
  expect(screen.getAllByRole('radio').map(r => (r as HTMLInputElement).value)).toEqual(order);
  expect((screen.getByRole('radio', { name: '仁', exact: true }) as HTMLInputElement).checked).toBe(true);
  view.rerender(<RecallExercise {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Check first answer' }));
  await screen.findByText('Correct on the first answer');
  expect(screen.queryByText(/syllables spelled correctly/)).toBeNull();
});
it('fails a character-choice attempt if the native answer is revealed during its check', async () => {
  const { props, view, values } = setup({ context: { cardId: 'choice', schema: choiceSchema } }); await begin();
  let release!: (value: boolean) => void;
  view.rerender(<RecallExercise {...props} isCurrent={() => new Promise(resolve => { release = resolve; })} />);
  fireEvent.click(screen.getByRole('radio', { name: '仁', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Check first answer' }));
  view.rerender(<RecallExercise {...props} revealed />);
  await act(async () => release(true));
  await screen.findByText('Skill result saved and read back.');
  expect(values.get(skillHistoryKey(choiceSchema))).toMatchObject({ attempts: 1, passed: 0, history: [{ result: { failure: 'answer-revealed' } }] });
});
it('allows spoken self-assessment without a recording and requires completed reference playback for success', async () => {
  const spokenSchema: RecallSchema = { ...schema, skill: 'pronunciation', referenceAudio: 'https://example.com/reference.mp3' };
  const { view, values } = setup({ context: { cardId: 'spoken', schema: spokenSchema } }); await begin(true);
  expect((screen.getByRole('button', { name: 'Play reference audio' }) as HTMLButtonElement).disabled).toBe(true);
  expect(view.container.innerHTML).not.toContain('rén');
  fireEvent.click(screen.getByRole('button', { name: 'I’ve said it — compare with reference' }));
  expect((screen.getByRole('button', { name: 'I pronounced it correctly' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Play reference audio' }));
  act(() => audio.play.mock.calls[0][0].onEnded());
  fireEvent.click(screen.getByRole('button', { name: 'I pronounced it correctly' }));
  await screen.findByText('Skill result saved and read back.');
  expect(values.get(skillHistoryKey(spokenSchema))).toMatchObject({ attempts: 1, passed: 1, history: [{ result: { assessment: 'self' } }] });
  expect(screen.queryByLabelText('Your pronunciation recording')).toBeNull();
});

it.each(['chinese-to-english'] as const)('supports typed %s with frozen first answers and explicit synonym-aware self-assessment', async skill => {
  const translation: RecallSchema = { ...schema, skill, pinyin: '' };
  const { view, props, store, values } = setup({ context: { cardId: 'translation', schema: translation } });
  await begin();
  expect(view.container.innerHTML).not.toContain('benevolence');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'kindness' } });
  fireEvent.click(screen.getByRole('button', { name: 'Compare first answer' }));
  await screen.findByRole('button', { name: 'My answer is correct' });
  expect(view.container.querySelector('.hm-recall-prompt')).toBeNull();
  expect(store.setSynced).not.toHaveBeenCalled(); expect(screen.queryByRole('textbox')).toBeNull();
  // Once the learner intentionally sees the reference, native reveal no longer invalidates self-assessment.
  view.rerender(<RecallExercise {...props} revealed />);
  fireEvent.click(screen.getByRole('button', { name: 'My answer is correct' }));
  await screen.findByText('Skill result saved and read back.');
  expect(values.get(skillHistoryKey(translation))).toMatchObject({ attempts: 1, passed: 1, history: [{ result: { assessment: 'self', answer: 'kindness' } }] });
});
it('fails translation recall on premature native reveal and preserves it in study mode', async () => {
  const translation: RecallSchema = { ...schema, skill: 'chinese-to-english' };
  const { props, view, values } = setup({ context: { cardId: 'translation', schema: translation } }); await begin();
  view.rerender(<RecallExercise {...props} revealed />);
  await screen.findByText('Skill result saved and read back.');
  fireEvent.click(screen.getByRole('button', { name: 'Study with the reference' }));
  expect(values.get(skillHistoryKey(translation))).toMatchObject({ attempts: 1, passed: 0, history: [{ result: { failure: 'answer-revealed' } }] });
});
it('keeps the listening target out of the question DOM and blocks checking until audio finishes', async () => {
  const { view } = setup({ context: { cardId: 'l', schema: { ...schema, skill: 'listening', referenceAudio: 'https://example.com/audio.mp3' } } });
  await begin();
  expect(view.container.innerHTML).not.toContain('仁'); expect(view.container.innerHTML).not.toContain('rén');
  expect(view.container.innerHTML).not.toContain('benevolence');
  fireEvent.change(screen.getByLabelText('Your pinyin'), { target: { value: 'ren2' } });
  expect((screen.getByRole('button', { name: 'Check first answer' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Play reference audio' }));
  act(() => audio.play.mock.calls[0][0].onEnded());
  fireEvent.click(screen.getByRole('button', { name: 'Check first answer' }));
  await screen.findByText('Skill result saved and read back.');
});
it('a native answer reveal wins over a delayed correct-answer check', async () => {
  const { props, view, values } = setup(); await begin();
  let release!: (current: boolean) => void;
  view.rerender(<RecallExercise {...props} isCurrent={() => new Promise(resolve => { release = resolve; })} />);
  fireEvent.change(screen.getByLabelText('Your pinyin'), { target: { value: 'ren2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check first answer' }));
  view.rerender(<RecallExercise {...props} revealed />);
  await act(async () => { release(true); });
  await screen.findByText('Skill result saved and read back.');
  expect(values.get(skillHistoryKey(schema))).toMatchObject({ attempts: 1, passed: 0, history: [{ result: { failure: 'answer-revealed' } }] });
});
it('study-only mode and an already revealed card cannot generate a successful test', async () => {
  const { store } = setup({ revealed: true });
  const button = await screen.findByRole('button', { name: 'Begin recall test' });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Study with answer' }));
  await screen.findByText('Study only. This does not save a test result.');
  expect(store.setSynced).not.toHaveBeenCalled();
});
it('preserves answers during a host interruption and retries a failed save with the same result', async () => {
  const { props, view, store } = setup(); await begin();
  fireEvent.change(screen.getByLabelText('Your pinyin'), { target: { value: 'ren2' } });
  view.rerender(<RecallExercise {...props} suspended />);
  expect((screen.getByLabelText('Your pinyin') as HTMLInputElement).value).toBe('rén');
  view.rerender(<RecallExercise {...props} />);
  const write = store.setSynced; store.setSynced = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockImplementation(write);
  fireEvent.click(screen.getByRole('button', { name: 'Check first answer' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry result save' }));
  await screen.findByText('Skill result saved and read back.');
  const writes = vi.mocked(store.setSynced).mock.calls;
  expect(writes[0][1]).toEqual(writes[1][1]);
});
