import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { localMandarinVoices, playReference } from '../src/services/audio';
import { PronunciationRecorder } from '../src/ui/PronunciationRecorder';
beforeEach(() => {
  vi.stubGlobal('speechSynthesis', { getVoices: () => [
    { name: 'Taiwan', lang: 'zh-TW', localService: true },
    { name: 'Remote', lang: 'zh-CN', localService: false },
    { name: 'English', lang: 'en-US', localService: true },
    { name: 'Hong Kong', lang: 'zh-HK', localService: true },
  ] });
});
afterEach(() => vi.unstubAllGlobals());
it('offers only local Mandarin voices and never silently falls back to remote speech', () => {
  expect(localMandarinVoices().map(v => v.name)).toEqual(['Taiwan']);
  expect(() => playReference({ text: '人', onEnded: () => {}, onError: () => {} })).toThrow('local Mandarin');
});
it('stops pending audio and ignores late completion after a card is left', async () => {
  const ended = vi.fn(), pause = vi.fn(); let instance: { onended(): void };
  vi.stubGlobal('Audio', class {
    onended = () => {}; onerror = () => {};
    play = async () => {}; pause = pause; removeAttribute = vi.fn(); load = vi.fn();
    constructor() { instance = this; }
  });
  const stop = playReference({ text: '人', url: 'https://example.com/audio.mp3', onEnded: ended, onError: () => {} });
  stop(); instance!.onended(); expect(pause).toHaveBeenCalled(); expect(ended).not.toHaveBeenCalled();
});
it('does not request microphone access on mount and stops a late permission result after unmount', async () => {
  let release!: (stream: MediaStream) => void; const stop = vi.fn();
  const getUserMedia = vi.fn(() => new Promise<MediaStream>(resolve => { release = resolve; }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } }); vi.stubGlobal('MediaRecorder', class {});
  const view = render(<PronunciationRecorder onReady={() => {}} />);
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Record pronunciation' }));
  view.unmount();
  await act(async () => { release({ getTracks: () => [{ stop }] } as unknown as MediaStream); });
  expect(stop).toHaveBeenCalledTimes(1);
});
it('provides an audio-file fallback when the host cannot grant microphone access', async () => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => { throw new Error('blocked'); } } });
  vi.stubGlobal('MediaRecorder', class {});
  render(<PronunciationRecorder onReady={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Record pronunciation' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('choose a recording'));
  expect(screen.getByLabelText('Or choose a pronunciation recording')).toBeTruthy();
});
