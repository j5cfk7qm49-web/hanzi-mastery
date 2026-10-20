import React, { useRef, useState } from 'react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { RECALL_NAMES, RECALL_SKILLS, type RecallSkill } from '../core/recall';
import { ensureRecallCard } from '../services/recall';
import { ensureCollection } from '../services/remnote';

export function StudySkills({ plugin, vocabularyId, traditional, pinyin, meaning, audio }: {
  plugin: RNPlugin; vocabularyId: string; traditional: string; pinyin: string; meaning: string; audio?: string;
}) {
  const [referenceAudio, setReferenceAudio] = useState(audio || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [lastCard, setLastCard] = useState(''); const guard = useRef(false);
  const create = async (skill: RecallSkill) => {
    if (guard.current) return; guard.current = true; setBusy(true); setError(''); setStatus('');
    try {
      const parent = await ensureCollection(plugin);
      const id = await ensureRecallCard(plugin, { version: 1, skill, vocabularyId, traditional, pinyin, meaning,
        ...(referenceAudio.trim() ? { referenceAudio: referenceAudio.trim() } : {}) }, parent);
      setLastCard(id); setStatus(`${RECALL_NAMES[skill]} card is ready in Hanzi Mastery. Repeating this action reuses this vocabulary’s card for that skill.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'The study card could not be created.'); }
    finally { guard.current = false; setBusy(false); }
  };
  return <section className="hm-study-authoring" aria-label="Other study skills">
    <h2>Pinyin, tones, listening and speaking</h2>
    <p>Each skill gets its own review card and schedule, linked to this vocabulary entry. Supply one reading with a pinyin syllable for each character.</p>
    <label>Reference audio URL (optional)<input type="url" value={referenceAudio} disabled={busy} onChange={e => setReferenceAudio(e.target.value)} placeholder="https://…" /></label>
    <p className="hm-muted">Use a recording of this exact item. Without a recording, audio exercises need a local Mandarin device voice, selected during review. Recordings are fetched only when you play them.</p>
    <div className="hm-actions">{RECALL_SKILLS.map(skill => <button key={skill} disabled={busy} onClick={() => void create(skill)}>Create {RECALL_NAMES[skill].toLowerCase()} card</button>)}</div>
    {status && <p role="status">{status}</p>}{error && <p role="alert" className="hm-error">{error}</p>}
    {lastCard && <button disabled={busy} onClick={() => void (async () => {
      if (guard.current) return; guard.current = true; setBusy(true); setError('');
      try {
        const rem = await plugin.rem.findOne(lastCard);
        if (!rem) throw new Error('The study card could not be found.');
        await plugin.window.openRem(rem); await plugin.widget.closePopup();
      } catch (e) { setError(e instanceof Error ? e.message : 'The study card could not be opened.'); }
      finally { guard.current = false; setBusy(false); }
    })()}>Open last study card</button>}
  </section>;
}
