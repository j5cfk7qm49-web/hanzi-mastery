import React, { useState } from 'react';
import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReviewContext } from '../src/services/remnote';
const mocks = vi.hoisted(() => ({ read: vi.fn(), refresh: () => {}, reveal: (_id?: string) => {},
  plugin: { storage: { getSynced: async () => undefined } } }));
vi.mock('@remnote/plugin-sdk', () => ({ usePlugin: () => mocks.plugin, renderWidget: () => {} }));
vi.mock('../src/services/remnote', () => ({ readReviewContext: mocks.read, stillCurrent: async () => true,
  subscribeReview: (_plugin: unknown, refresh: () => void, reveal: (id?: string) => void) => {
    mocks.refresh = refresh; mocks.reveal = reveal; return () => {};
  } }));
vi.mock('../src/ui/ReviewExercise', () => ({ ReviewExercise: ({ suspended, revealed, context }: {
  suspended?: boolean; revealed: boolean; context: ReviewContext;
}) => {
  const [strokes, setStrokes] = useState(0);
  return <div><p>{context.prompt}</p><p>{suspended ? 'Paused' : 'Active'} / {revealed ? 'Revealed' : 'Hidden'} / {strokes} strokes</p>
    <button onClick={() => setStrokes(n => n+1)}>Record stroke</button></div>;
} }));
import { HanziReview } from '../src/widgets/hanzi_review';
const context: ReviewContext = { cardId: 'c', vocabularyId: 'v', chars: ['學'], prompt: 'study', key: 'c:0', revealed: false, reviewAt: 0 };
beforeEach(() => mocks.read.mockReset().mockResolvedValue(context));
it('a transient host error pauses the mounted exercise and restores the same attempt', async () => {
  render(<HanziReview/>);fireEvent.click(await screen.findByText('Record stroke'));
  mocks.read.mockRejectedValueOnce(new Error('private host error'));
  mocks.refresh();await screen.findByText('Paused / Hidden / 1 strokes');
  expect(screen.queryByText('private host error')).toBeNull();
  mocks.refresh();await screen.findByText('Active / Hidden / 1 strokes');
});
it('latches answer reveal despite a stale host response and resets on a new review identity', async () => {
  render(<HanziReview/>);await screen.findByText('Record stroke');
  mocks.reveal('c');await screen.findByText('Active / Revealed / 0 strokes');
  mocks.refresh();await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(3));
  expect(screen.getByText('Active / Revealed / 0 strokes')).toBeTruthy();
  mocks.read.mockResolvedValue({ ...context, key:'c:1' });
  mocks.refresh();await screen.findByText('Active / Hidden / 0 strokes');
});
it('removes an exercise when RemNote confirms the card is no longer eligible', async () => {
  render(<HanziReview/>);await screen.findByText('Record stroke');
  mocks.read.mockResolvedValue(null);mocks.refresh();
  await waitFor(() => expect(screen.queryByText('Record stroke')).toBeNull());
});
