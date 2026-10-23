import React, { useEffect, useRef, useState } from 'react';
import { localMandarinVoices, playReference } from '../services/audio';

export function ReferenceAudio({ text, url, disabled, onPlayed }: {
  text: string; url?: string; disabled?: boolean; onPlayed(): void;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]), [selected, setSelected] = useState('');
  const [playing, setPlaying] = useState(false), [error, setError] = useState('');
  const stop = useRef<() => void>(() => {}), latest = useRef(onPlayed); latest.current = onPlayed;
  useEffect(() => {
    const refresh = () => {
      const available = localMandarinVoices(); setVoices(available);
      setSelected(old => old || available.find(v => /^zh[-_]TW$/i.test(v.lang))?.voiceURI || '');
    };
    refresh();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.removeEventListener('voiceschanged', refresh); };
  }, []);
  useEffect(() => {
    if (disabled) { stop.current(); setPlaying(false); }
    return () => stop.current();
  }, [disabled, text, url]);
  const play = () => {
    stop.current(); setError(''); setPlaying(true);
    try {
      stop.current = playReference({ text, url, voice: voices.find(v => v.voiceURI === selected),
        onEnded: () => { setPlaying(false); latest.current(); },
        onError: () => { setPlaying(false); setError('Reference audio could not play. Retry, choose another local voice, or supply a recording in the workbench.'); } });
    } catch (e) { setPlaying(false); setError(e instanceof Error ? e.message : 'Reference audio is unavailable.'); }
  };
  return <div className="hm-reference-audio">
    {!url && <label>Reference voice<select aria-label="Reference voice" value={selected} disabled={disabled || playing}
      onChange={e => setSelected(e.target.value)}><option value="">Choose a local Mandarin voice</option>
      {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select></label>}
    {!url && !voices.length && <p className="hm-muted">No local Mandarin voice is available. Add an HTTPS audio recording in the workbench to use this exercise.</p>}
    <div className="hm-actions"><button className="hm-audio-button" disabled={disabled || playing || (!url && !selected)} onClick={play}><span aria-hidden="true">▶</span> Play reference audio</button>
      {playing && <button onClick={() => { stop.current(); setPlaying(false); }}>Stop audio</button>}</div>
    {playing && <p role="status">Playing reference audio…</p>}
    {error && <p role="alert" className="hm-error">{error}</p>}
    {!url && <p className="hm-muted"><small>Local synthesized voice · check its language region.</small></p>}
  </div>;
}
