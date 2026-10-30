import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
it('uses the same Shtooka recording in FLAC on browsers without Ogg support', () => {
  let instance: { src: string }; let ogg = '', flac = 'probably';
  vi.stubGlobal('Audio', class {
    src = ''; play = async () => {};
    canPlayType(type: string) { return type === 'audio/flac' ? flac : ogg; }
    constructor() { instance = this; }
  });
  const url = 'https://fsi-languages.yojik.eu/audiocollections/detailled/cmn-caen-tan/ogg/cmn-1234abcd.ogg';
  const play = (audioUrl = url) => playReference({ text: '人', url: audioUrl, onEnded: vi.fn(), onError: vi.fn() });
  play(); expect(instance!.src).toBe(url.replace('/ogg/', '/flac/').replace('.ogg', '.flac'));
  ogg = 'probably'; play(); expect(instance!.src).toBe(url);
  ogg = ''; flac = ''; play(); expect(instance!.src).toBe(url);
  flac = 'probably';
  for (const custom of ['https://example.com/ogg/cmn-1234abcd.ogg', url + '?custom=1', url.replace('yojik.eu', 'yojik.eu.example.com')]) {
    play(custom); expect(instance!.src).toBe(custom);
  }
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

it('ignores stop/error callbacks from an older recording after a new capture starts', async () => {
  const firstStop = vi.fn(), secondStop = vi.fn(), captures: { onstop(): void; onerror(): void }[] = [];
  const getUserMedia = vi.fn().mockResolvedValueOnce({ getTracks: () => [{ stop: firstStop }] })
    .mockResolvedValueOnce({ getTracks: () => [{ stop: secondStop }] });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', class {
    state = 'inactive'; onstop = () => {}; onerror = () => {};
    constructor() { captures.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; }
  });
  const ready = vi.fn(), view = render(<PronunciationRecorder onReady={ready} />);
  fireEvent.click(screen.getByRole('button', { name: 'Record pronunciation' }));
  await screen.findByRole('button', { name: 'Stop recording' });
  view.rerender(<PronunciationRecorder onReady={ready} disabled />);
  view.rerender(<PronunciationRecorder onReady={ready} />);
  fireEvent.click(screen.getByRole('button', { name: 'Record pronunciation' }));
  await waitFor(() => expect(captures).toHaveLength(2));
  act(() => { captures[0].onstop(); captures[0].onerror(); });
  expect(secondStop).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Stop recording' })).toBeTruthy();
  expect(ready).not.toHaveBeenCalled();
  view.unmount(); expect(secondStop).toHaveBeenCalledTimes(1);
});

it('does not stop a new capture when an older microphone request rejects late', async () => {
  let rejectFirst!: (error: Error) => void;
  const stop = vi.fn(), getUserMedia = vi.fn()
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
    .mockResolvedValueOnce({ getTracks: () => [{ stop }] });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', class {
    state = 'inactive'; start() { this.state = 'recording'; } stop() { this.state = 'inactive'; }
  });
  const ready = vi.fn(), view = render(<PronunciationRecorder onReady={ready} />);
  fireEvent.click(screen.getByRole('button', { name: 'Record pronunciation' }));
  view.rerender(<PronunciationRecorder onReady={ready} disabled />);
  view.rerender(<PronunciationRecorder onReady={ready} />);
  fireEvent.click(screen.getByRole('button', { name: 'Record pronunciation' }));
  await screen.findByRole('button', { name: 'Stop recording' });
  await act(async () => { rejectFirst(new Error('late permission denial')); });
  expect(stop).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Stop recording' })).toBeTruthy();
  view.unmount(); expect(stop).toHaveBeenCalledTimes(1);
});
