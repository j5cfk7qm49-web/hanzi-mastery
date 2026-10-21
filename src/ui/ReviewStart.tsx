import React, { useEffect, useRef, useState } from 'react';

/** Match the writing surface before the explicit, guarded start of a test. */
export function ReviewStart({ fit, children }: { fit: boolean; children: React.ReactNode }) {
  const area = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(200);
  useEffect(() => {
    const resize = () => {
      if (!area.current) return;
      const next = Math.max(1, Math.min((area.current.clientWidth || 280) - 2, fit ? (area.current.clientHeight || 280) - 2 : 320));
      setSize(old => old === next ? old : next);
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(area.current!);
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [fit]);
  return <div ref={area} className="hm-ready-stage"><div className="hm-ready-square" style={{ width: size, height: size }}>
    <div className="hm-ready-prompt">{children}</div>
  </div></div>;
}
