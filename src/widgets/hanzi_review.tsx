import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { parseSettings, type Settings } from '../core/config';
import { SETTINGS_KEY } from '../core/schema';
import { MasteryRepository } from '../services/persistence';
import { readReviewContext, stillCurrent, subscribeReview, type ReviewContext } from '../services/remnote';
import { ReviewExercise } from '../ui/ReviewExercise';
import '../ui/styles.css';
function HanziReview() {
  const plugin = usePlugin();
  const [state, setState] = useState<{ context: ReviewContext; settings: Settings }>();
  const [error, setError] = useState('');
  const current = useRef<ReviewContext>();
  const repository = useMemo(() => new MasteryRepository(plugin.storage), [plugin]);
  useEffect(() => {
    let live = true, running = false, dirty = false;
    const refresh = async () => {
      if (running) { dirty = true; return; }
      running = true;
      try {
        do {
          dirty = false;
          const settings = parseSettings(await plugin.storage.getSynced(SETTINGS_KEY));
          const context = await readReviewContext(plugin, settings);
          if (!live) return;
          current.current = context || undefined; setError('');
          setState(old => !context ? undefined : old?.context.key === context.key && old.context.revealed === context.revealed ? old : { context, settings });
        } while (dirty && live);
      } catch { if (live) { current.current = undefined; setState(undefined); setError('Hanzi Mastery could not read this review or its settings. Check the card configuration, then retry.'); } }
      finally { running = false; }
    };
    const unsubscribe = subscribeReview(plugin, () => { void refresh(); }, cardId => {
      if (cardId && current.current?.cardId !== cardId) return;
      setState(s => s ? { ...s, context: { ...s.context, revealed: true } } : s);
      void refresh();
    });
    void refresh();
    const interval = window.setInterval(() => void refresh(), 750);
    return () => { live = false; window.clearInterval(interval); unsubscribe(); };
  }, [plugin]);
  if (error) return <div className="hm"><p role="alert" className="hm-error">{error}</p></div>;
  if (!state) return null;
  // Stable exercise context prevents answer-side state updates from reloading/resetting the attempt.
  return <BoundExercise key={state.context.key} context={state.context} settings={state.settings} repository={repository}
    isCurrent={(allowRevealed) => stillCurrent(plugin, state.context.cardId, allowRevealed)} />;
}
function BoundExercise({ context, settings, repository, isCurrent }: {
  context: ReviewContext; settings: Settings; repository: MasteryRepository; isCurrent(allowRevealed?: boolean): Promise<boolean>;
}) {
  const stable = useRef(context);
  return <ReviewExercise context={stable.current} settings={settings} repository={repository} revealed={context.revealed}
    isCurrent={isCurrent} />;
}
renderWidget(HanziReview);
