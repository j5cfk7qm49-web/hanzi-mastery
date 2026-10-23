import React, { useEffect, useRef, useState } from 'react';

export function PronunciationRecorder({ disabled, onReady }: { disabled?: boolean; onReady(): void }) {
  const [state, setState] = useState<'idle'|'requesting'|'recording'|'ready'>('idle');
  const [url, setUrl] = useState(''), [error, setError] = useState('');
  const stream = useRef<MediaStream>(), recorder = useRef<MediaRecorder>(), timer = useRef<number>();
  const objectUrl = useRef(''), generation = useRef(0), live = useRef(true), latest = useRef(onReady);
  latest.current = onReady;
  const stopTracks = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = undefined; window.clearTimeout(timer.current); };
  const stopCapture = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); stopTracks(); };
  useEffect(() => () => {
    live.current = false; generation.current++; stopCapture();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);
  useEffect(() => {
    if (disabled) { generation.current++; stopCapture(); setState(s => s === 'ready' ? s : 'idle'); }
  }, [disabled]);
  const keep = (blob: Blob) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(blob); setUrl(objectUrl.current); setState('ready'); latest.current();
  };
  const record = async () => {
    if (disabled || state !== 'idle') return;
    const token = ++generation.current; setError(''); setState('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported');
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!live.current || token !== generation.current) { input.getTracks().forEach(t => t.stop()); return; }
      stream.current = input;
      const capture = new MediaRecorder(input); recorder.current = capture;
      const chunks: Blob[] = [];
      capture.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      capture.onerror = () => {
        generation.current++; stopTracks();
        if (live.current) { setState('idle'); setError('Recording stopped unexpectedly. Try again or choose an audio file.'); }
      };
      capture.onstop = () => {
        stopTracks();
        if (!live.current || token !== generation.current) return;
        const blob = new Blob(chunks, { type: capture.mimeType || chunks[0]?.type || 'audio/webm' });
        if (blob.size) keep(blob);
        else { setState('idle'); setError('The recording was empty. Try again or choose an audio file.'); }
      };
      capture.start(); setState('recording');
      timer.current = window.setTimeout(stopCapture, 20000);
    } catch {
      stopTracks();
      if (live.current && token === generation.current) { setState('idle'); setError('Microphone access is unavailable here. You can choose a recording from your device instead.'); }
    }
  };
  return <div className="hm-recorder">
    {state === 'idle' && <button className="hm-audio-button" disabled={disabled} onClick={() => void record()}><span aria-hidden="true">●</span> Record pronunciation</button>}
    {state === 'requesting' && <p role="status">Waiting for microphone access…</p>}
    {state === 'recording' && <><p role="status">Recording… up to 20 seconds.</p><button onClick={stopCapture}>Stop recording</button></>}
    {state !== 'ready' && <details className="hm-recording-file"><summary>Use an audio file</summary><label>Or choose a pronunciation recording<input type="file" accept="audio/*" disabled={disabled || state !== 'idle'} onChange={e => {
      const file = e.target.files?.[0]; if (!file) return;
      if ((!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|webm|mp4)$/i.test(file.name)) || file.size > 10 * 1024 * 1024 || !file.size) {
        setError('Choose an audio file smaller than 10 MB.'); e.target.value = ''; return;
      }
      setError(''); keep(file);
    }} /></label><small>Your clip stays in this review and is discarded when you leave.</small></details>}
    {url && <audio controls src={url} aria-label="Your pronunciation recording" />}
    {error && <p role="alert" className="hm-error">{error}</p>}
  </div>;
}
