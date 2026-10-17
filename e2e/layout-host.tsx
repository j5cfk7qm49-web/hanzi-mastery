// Geometry/scrolling test fixture. This is not RemNote's iOS UI or scheduling code.
import React, { useEffect, useRef, useState } from 'react';
import './layout-host.css';
export function LayoutHost() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1), [revealed, setRevealed] = useState(false);
  const params = new URLSearchParams(location.search);
  const width = Number(params.get('width')) || 680;
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== 'hm-layout-height') return;
      if (Number.isFinite(event.data.height) && event.data.height > 0) setHeight(Math.ceil(event.data.height));
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  return <div className="hm-layout-host" style={{maxWidth:width}}>
    <header className="hm-layout-toolbar">Simulated RemNote review pane</header>
    <main className="hm-layout-scroll" aria-label="Simulated queue scroll area">
      <p className="hm-layout-question">Write the word from its English prompt.</p>
      <iframe ref={frame} title="Handwriting review fixture" src={`/?frame=review${params.has('long') ? '&long=1' : ''}`} style={{height}} />
    </main>
    <footer className="hm-layout-native" aria-label="Simulated native RemNote controls">
      {revealed ? ['Forgot','Hard','Good','Easy'].map(label=><button key={label}>{label}</button>) :
        <button onClick={()=>{setRevealed(true);frame.current?.contentWindow?.postMessage({type:'hm-layout-reveal'},location.origin);}}>Native Show Answer (simulated)</button>}
    </footer>
  </div>;
}
