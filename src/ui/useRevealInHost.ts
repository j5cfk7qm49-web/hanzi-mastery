import { useEffect } from 'react';

/** Reveal content through the browser's normal scrolling ancestors, including the host pane. */
export function useRevealInHost(getTarget: () => Element | null, enabled: boolean,
  generation = 0, block: ScrollLogicalPosition = 'nearest') {
  useEffect(() => {
    if (!enabled) return;
    const reveal = () => getTarget()?.scrollIntoView?.({ block });
    reveal();
    // Allow the SDK's asynchronous host-size message to settle before the second adjustment.
    const settled = window.setTimeout(reveal, 300);
    const stop = () => window.clearTimeout(settled);
    document.addEventListener('touchstart', stop, { capture: true, passive: true });
    document.addEventListener('mousedown', stop, true);
    document.addEventListener('pointerdown', stop, true);
    document.addEventListener('wheel', stop, { capture: true, passive: true });
    return () => {
      window.clearTimeout(settled);
      document.removeEventListener('touchstart', stop, true);
      document.removeEventListener('mousedown', stop, true);
      document.removeEventListener('pointerdown', stop, true);
      document.removeEventListener('wheel', stop, true);
    };
  }, [getTarget, enabled, generation, block]);
}
