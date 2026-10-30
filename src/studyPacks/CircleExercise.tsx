import React, { useRef } from 'react';

/** A circle records the learner's selection, never an unverified correctness claim. */
export function CircleExercise({ glyph, points, onChange, disabled }: {
  glyph:string; points:number[][][]; onChange(points:number[][][]):void; disabled?:boolean;
}) {
  const pointer = useRef<number>(), current = useRef(points); current.current = points;
  const point = (e:React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [Math.max(0,Math.min(300,(e.clientX-rect.left)/rect.width*300)), Math.max(0,Math.min(300,(e.clientY-rect.top)/rect.height*300))];
  };
  return <div className="hm-pack-circle">
    <svg viewBox="0 0 300 300" role="img" aria-label={`Circle the radical in ${glyph}`} style={{touchAction:disabled ? 'auto' : 'none'}}
      onPointerDown={e => { if (disabled || pointer.current !== undefined || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if(current.current.length>=50)return;
        pointer.current=e.pointerId; try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* Some embedded hosts do not support pointer capture. */ } onChange([...current.current,[point(e)]]); }}
      onPointerMove={e => { if (disabled || pointer.current !== e.pointerId) return;
        const last=current.current.at(-1); if (!last || last.length >= 1200) return;
        onChange([...current.current.slice(0,-1),[...last,point(e)]]); }}
      onPointerUp={e => { if (pointer.current===e.pointerId) { pointer.current=undefined; e.currentTarget.releasePointerCapture?.(e.pointerId); } }}
      onPointerCancel={() => { pointer.current=undefined; }}>
      <text x="150" y="230" textAnchor="middle" lang="zh-Hant" fontSize="250" fill="currentColor">{glyph}</text>
      {points.map((stroke,i) => <polyline key={i} points={stroke.map(p => p.join(',')).join(' ')} fill="none" stroke="#ed7739" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    <button disabled={disabled || !points.length} onClick={() => onChange([])}>Clear circle</button>
    <p className="hm-caption">Circle with a finger, pen or mouse. Keyboard alternative: describe the component’s location in your answer, then compare on reveal.</p>
  </div>;
}
