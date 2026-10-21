// Geometry/scrolling test fixture. This is not RemNote's iOS UI or scheduling code.
import React, { useRef, useState } from 'react';
import { REVIEW_HOST_CSS } from '../src/ui/reviewHostCss';
import './layout-host.css';
export function LayoutHost() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [revealed, setRevealed] = useState(false);
  const params = new URLSearchParams(location.search);
  const width = Number(params.get('width')) || 680;
  const unrelated = params.has('unrelated');
  return <div className="hm-layout-host rn-queue" style={{maxWidth:width}}>
    <style>{REVIEW_HOST_CSS}</style>
    <header className="hm-layout-toolbar">Simulated RemNote review pane</header>
    <div className="hm-layout-card"><div className="hm-layout-statistics">Statistics</div>
      <main className="hm-layout-scroll width-container-scroller" aria-label="Simulated queue scroll area">
        <div className="rn-queue__content"><div className="hm-layout-native-content">
          <p className="hm-layout-question">Write the word from its English prompt.</p>
          <div className="spaced-repetition-answer">{revealed ? 'Native answer' : ''}</div>
          <div className="fade-in-first-load relative"><div style={{display:'flex'}}>
            <iframe ref={frame} data-plugin-id={unrelated ? 'another-plugin' : 'hanzi_mastery_handwriting_v1'} title="Handwriting review fixture"
              src={unrelated ? 'about:blank' : `/?frame=review&widgetName=hanzi_review${params.has('long') ? '&long=1' : ''}`} style={{height:400}} />
          </div></div>
        </div></div>
      </main>
    </div>
    <footer className="hm-layout-native" aria-label="Simulated native RemNote controls">
      {revealed ? ['Forgot','Hard','Good','Easy'].map(label=><button key={label}>{label}</button>) :
        <button onClick={()=>{setRevealed(true);frame.current?.contentWindow?.postMessage({type:'hm-layout-reveal'},location.origin);}}>Native Show Answer (simulated)</button>}
    </footer>
  </div>;
}
