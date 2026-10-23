import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RNPlugin } from '@remnote/plugin-sdk';
const mocks = vi.hoisted(() => ({ choices: vi.fn(), ensure: vi.fn(), collection: vi.fn() }));
vi.mock('../src/services/recall', () => ({ ensureRecallCard: mocks.ensure, ensureTranslationCards:async()=>['card'], vocabularyCharacterChoices: mocks.choices }));
vi.mock('../src/services/lists', () => ({ vocabularyParent: mocks.collection }));
import { StudySkills } from '../src/ui/StudySkills';
beforeEach(() => {
  mocks.choices.mockReset().mockResolvedValue([{ traditional: '人', pinyin: 'rén' }, { traditional: '書', pinyin: 'shū' }]);
  mocks.ensure.mockReset().mockResolvedValue('card');
  mocks.collection.mockReset().mockResolvedValue('collection');
});
const plugin = {} as RNPlugin;
it('creates recognition from verified vocabulary choices and preserves the shared vocabulary link', async () => {
  render(<StudySkills plugin={plugin} vocabularyId="v" traditional="人" pinyin="rén" meaning="person" />);
  fireEvent.click(screen.getByRole('button', { name: 'Create character recognition card' }));
  await screen.findByRole('button', { name: 'Open last study card' });
  expect(mocks.choices).toHaveBeenCalledWith(plugin, { traditional: '人', pinyin: 'rén' });
  expect(mocks.ensure).toHaveBeenCalledWith(plugin, expect.objectContaining({ skill: 'character-choice', vocabularyId: 'v',
    choices: [{ traditional: '人', pinyin: 'rén' }, { traditional: '書', pinyin: 'shū' }] }), 'v');
});
it('does not create cards or a collection when unambiguous choices are unavailable', async () => {
  mocks.choices.mockRejectedValueOnce(new Error('Add another Hanzi Vocabulary entry.'));
  render(<StudySkills plugin={plugin} vocabularyId="v" traditional="人" pinyin="rén" meaning="person" />);
  fireEvent.click(screen.getByRole('button', { name: 'Create character recognition card' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Add another Hanzi Vocabulary entry.');
  expect(mocks.ensure).not.toHaveBeenCalled(); expect(mocks.collection).not.toHaveBeenCalled();
});
it('validates metadata before writes and keeps other study skills independent of the choice bank', async () => {
  const view = render(<StudySkills plugin={plugin} vocabularyId="v" traditional="人" pinyin="rén rén" meaning="person" />);
  fireEvent.click(screen.getByRole('button', { name: 'Create pinyin recall card' }));
  await screen.findByRole('alert'); expect(mocks.collection).not.toHaveBeenCalled();
  view.rerender(<StudySkills plugin={plugin} vocabularyId="v" traditional="人" pinyin="rén" meaning="person" />);
  fireEvent.click(screen.getByRole('button', { name: 'Create spoken practice card' }));
  await screen.findByRole('button', { name: 'Open last study card' });
  expect(mocks.choices).not.toHaveBeenCalled();
  expect(mocks.ensure).toHaveBeenCalledWith(plugin, expect.objectContaining({ skill: 'pronunciation' }), 'v');
});
