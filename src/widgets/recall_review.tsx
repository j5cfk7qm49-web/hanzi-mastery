import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { readRecallContext, SkillRepository, type RecallContext } from '../services/recall';
import { stillCurrent, subscribeReview } from '../services/remnote';
import { RecallExercise } from '../ui/RecallExercise';
import { WidgetBoundary } from '../ui/WidgetBoundary';
import '../ui/styles.css';
import { parseSettings, type Settings } from '../core/config';
import { SETTINGS_KEY } from '../core/schema';

export function RecallReview() {
  const plugin = usePlugin();
  const repository = useMemo(() => new SkillRepository(plugin.storage), [plugin]);
  const [context, setContext] = useState<RecallContext>(), [error, setError] = useState('');
  const [settings, setSettings] = useState<Settings>();
  const current = useRef<RecallContext>();
  useEffect(() => {
    let live = true, running = false, dirty = false;
    const refresh = async () => {
      if (running) { dirty = true; return; } running = true;
      try {
        do {
          dirty = false;
          const next = await readRecallContext(plugin);
          const preferences = parseSettings(await plugin.storage.getSynced(SETTINGS_KEY));
          if (!live) return;
          current.current = next || undefined; setError('');
          setSettings(old => old && JSON.stringify(old) === JSON.stringify(preferences) ? old : preferences);
          setContext(old => {
            if (!next) return undefined;
            if (old?.key === next.key && (old.revealed || !next.revealed)) return old;
            return next;
          });
        } while (dirty && live);
      } catch { if (live) setError('The current RemNote study card could not be confirmed. Retrying automatically.'); }
      finally { running = false; }
    };
    const unsubscribe = subscribeReview(plugin, () => { void refresh(); }, cardId => {
      if (cardId && current.current?.cardId !== cardId) return;
      setContext(old => old ? { ...old, revealed: true } : old); void refresh();
    });
    void refresh(); const timer = window.setInterval(() => void refresh(), 750);
    return () => { live = false; window.clearInterval(timer); unsubscribe(); };
  }, [plugin]);
  if (!context) return <div className="hm">{error ? <p role="alert">{error}</p> :
    <p role="status">Hanzi Mastery is waiting for a matching study review. Reopen the review if this message stays.</p>}</div>;
  return <RecallExercise fitToCard settings={settings} assetRoot={plugin.rootURL} key={context.key} context={context} repository={repository} revealed={context.revealed} suspended={!!error}
    isCurrent={allow => stillCurrent(plugin, context.cardId, allow, context.reviewAt, context.direction)} />;
}
renderWidget(() => <WidgetBoundary><RecallReview /></WidgetBoundary>);
