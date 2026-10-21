import React, { useEffect, useRef } from 'react';

/** Optional details replace the canvas area without growing the surrounding card. */
export function ReviewSheet({ title, children, onClose }: {
  title: string; children: React.ReactNode; onClose(): void;
}) {
  const root = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,a[href],input:not(:disabled)') || []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('keydown', keys); previous?.focus({ preventScroll: true }); };
  }, [onClose]);
  return <div ref={root} className="hm-review-sheet" role="dialog" aria-modal="true" aria-label={title}>
    <header><h2>{title}</h2><button ref={close} className="hm-icon-button" aria-label="Close review details" onClick={onClose}>×</button></header>
    <div className="hm-review-sheet-body">{children}</div>
  </div>;
}
